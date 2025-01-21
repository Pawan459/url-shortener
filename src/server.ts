import express from "express";
import http from "http";
import { Server as WebSocketServer } from "ws";

import {
  PORT,
  BASE_URL,
  URLS_FILE,
  MESSAGES_FILE
} from "@app/config";

import { AsyncQueue } from "@app/concurrency";
import { UrlController } from "@app/controller";
import { MessageQueue, WebSocketService } from "@app/message";
import { UrlShortenerService } from "@app/services";
import { InMemoryUrlStorage, FileUrlStorage, CompositeUrlStorage } from "@app/storage";

/**
 * The main function initializes and starts the URL shortener server.
 * 
 * Steps performed:
 * 1. Creates concurrency queues for file operations.
 * 2. Initializes in-memory and file-based URL storages, and combines them into a composite storage.
 * 3. Creates the URL shortener service using the composite storage.
 * 4. Initializes a persistent message queue for WebSocket deliveries and loads existing messages from disk.
 * 5. Sets up an Express application with JSON parsing middleware.
 * 6. Creates an HTTP server and attaches a WebSocket server to it.
 * 7. Initializes the WebSocket service with the WebSocket server and persistent queue.
 * 8. Creates a URL controller to handle URL shortening and resolution.
 * 9. Defines HTTP routes for URL shortening and resolution.
 * 10. Starts the HTTP server and listens on the specified port.
 * 
 * Additionally, sets up a graceful shutdown procedure to close the WebSocket service,
 * persistent queue, and HTTP server on process termination (SIGINT).
 * 
 * @param {number} [port] - The port number to listen on. If not provided, the default port from the configuration is used.
 * @returns {Promise<{ app: express.Application, server: http.Server }>} The initialized Express application and HTTP server.
 */
export function main(port?: number): { app: express.Application; server: http.Server; } {
  // 1) Create concurrency queues for file operations
  const urlFileQueue = new AsyncQueue();    // for URLs file
  const msgFileQueue = new AsyncQueue();    // for messages queue file

  // 2) Create storages
  const inMemoryStorage = new InMemoryUrlStorage();
  const fileStorage = new FileUrlStorage(URLS_FILE, urlFileQueue);
  const compositeStorage = new CompositeUrlStorage(inMemoryStorage, fileStorage);

  // 3) Create the URL shortener service
  const urlShortener = new UrlShortenerService(compositeStorage, BASE_URL);

  // 4) Create a persistent message queue for WebSocket deliveries
  const persistentQueue = new MessageQueue(MESSAGES_FILE, msgFileQueue);

  // 5) Express + HTTP server
  const app = express();
  app.use(express.json());


  // 6) HTTP + WebSocket server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // 7) WebSocket service
  const wsService = new WebSocketService(wss, persistentQueue);

  // 8) Controller
  const urlController = new UrlController(urlShortener, wsService);

  // 9) Define routes
  app.post("/url", urlController.shortenUrl);
  app.get("/:code", urlController.resolveUrl);

  // 10) Start server
  const REAL_PORT = port || PORT;

  server.listen(REAL_PORT, () => {
    console.log(`Server listening on port ${REAL_PORT}`);
    console.log(`Base URL: ${BASE_URL}`);
  });

  // On process shutdown, gracefully close
  function shutdown(errorCode: string | number | null | undefined): void {
    console.log("Shutting down...");
    wsService.close();
    persistentQueue.close();

    server.close(() => {
      console.log("Server closed.");
      process.exit(errorCode);
    });
  }

  process.on('uncaughtException', (err: Error) => {
    console.error('Uncaught exception', err);
    shutdown(1);
  });
  process.on('unhandledRejection', (reason: {} | null | undefined) => {
    console.error('Unhandled Rejection at promise', reason);
    shutdown(2);
  });
  process.on('SIGINT', () => {
    console.info('Caught SIGINT');
    shutdown(128 + 2);
  });
  process.on('SIGTERM', () => {
    console.info('Caught SIGTERM');
    shutdown(128 + 2);
  });
  process.on('exit', () => {
    console.info('Exiting');
  });


  return { app, server };
}

if (require.main === module) {
  main();
}
