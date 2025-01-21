import type { Server, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { URL } from "url";

import { MessageQueue } from "./MessageQueue";

export class WebSocketService {
  private wss: Server;
  private messageQueue: MessageQueue;

  // clientId -> WebSocket
  private clients: Map<string, WebSocket> = new Map();

  private sendInterval: NodeJS.Timeout | null = null;

  constructor(wss: Server, messageQueue: MessageQueue) {
    this.wss = wss;
    this.messageQueue = messageQueue;
    this.setup();
  }

  /**
   * Sets up the WebSocket server to handle new connections, incoming messages, and disconnections.
   * 
   * - On a new connection:
   *   - Parses the `clientId` from the query string.
   *   - If `clientId` is not provided, closes the connection with code 1008.
   *   - Logs the connection and stores the socket in the `clients` map.
   *   - Sends back the `clientId` to the client.
   * 
   * - On receiving a message:
   *   - Parses the message and checks if it is an ACK message.
   *   - If it is an ACK message, acknowledges the message in the message queue.
   * 
   * - On socket close:
   *   - Logs the disconnection and removes the socket from the `clients` map.
   * 
   * - Periodically sends pending messages from the message queue.
   * 
   * @private
   */
  private setup(): void {
    // Handle new connections
    this.wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
      // Parse clientId from the query string
      const clientId = this.extractClientId(req.url);
      if (!clientId) {
        // If the client didn't provide a clientId, we could generate one
        // But for example, we can close the connection or do something else
        socket.close(1008, "clientId is required");
        return;
      }

      console.log(`Client connected: ${clientId}`);
      this.clients.set(clientId, socket);

      // Acknowledge or send back the clientId if the client is new
      socket.send(
        JSON.stringify({ type: "CLIENT_ID", clientId })
      );

      // Listen for ACK messages
      socket.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "ACK" && typeof msg.id === "string") {
            console.log(`Client ${clientId} acknowledged message ${msg.id}`);
            // Acknowledge the message
            await this.messageQueue.ack(msg.id);
          }
        } catch (error) {
          console.error("Failed to parse message from client:", error);
        }
      });

      socket.on("close", () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
    });

    // Periodically try to send pending messages
    this.sendInterval = setInterval(() => {
      void this.broadcastPendingMessages();
    }, 1000);
  }

  /**
   * Extracts clientId from something like "?clientId=xxxxx".
   */
  /**
   * Extracts the client ID from the given URL.
   *
   * @param url - The URL string from which to extract the client ID.
   * @returns The client ID if present in the URL's search parameters, otherwise `undefined`.
   */
  private extractClientId(url?: string): string | undefined {
    if (!url) return;
    try {
      const urlObj = new URL(url, "http://localhost"); // base is irrelevant here
      return urlObj.searchParams.get("clientId") || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Queues a message to be sent to a client.
   *
   * @param messageId - The unique identifier for the message.
   * @param clientId - The unique identifier for the client.
   * @param payload - The payload of the message to be sent.
   * @returns A promise that resolves when the message has been added to the queue.
   */
  public async queueMessage(
    messageId: string,
    clientId: string,
    payload: IMessagePayload
  ): Promise<void> {
    await this.messageQueue.add(messageId, clientId, payload);
  }

  /**
   * Broadcasts pending messages to their respective clients.
   * 
   * This method retrieves messages from the message queue that are due to be sent,
   * identifies the correct client for each message, and attempts to send the message
   * via WebSocket. If the client's socket is not active or an error occurs during
   * sending, the message is marked as a send failure and will be retried later with
   * exponential backoff.
   * 
   * @returns {Promise<void>} A promise that resolves when all due messages have been processed.
   */
  private async broadcastPendingMessages(): Promise<void> {
    const due = this.messageQueue.getMessagesToSend();

    for (const msg of due) {
      // Identify the correct client
      const clientSocket = this.clients.get(msg.clientId);

      if (!clientSocket || clientSocket.readyState !== clientSocket.OPEN) {
        console.log(`Client ${msg.clientId} is not connected`);
        // No active socket for this client -> onSendFailure -> exponential backoff
        await this.messageQueue.onSendFailure(msg.id);
        continue;
      }

      // Attempt to send
      const payload = JSON.stringify({
        type: "DELIVERY",
        id: msg.id,
        payload: msg.payload
      });

      try {
        clientSocket.send(payload, async (err?: Error) => {
          if (err) {
            console.error(`Failed to send msg ${msg.id} to client ${msg.clientId}`, err);
            await this.messageQueue.onSendFailure(msg.id);
          }
          // If no error, message is "sent" but not necessarily ack'd
          // We'll wait for ACK from the client
        });
      } catch (error) {
        console.error("Error during send:", error);
        await this.messageQueue.onSendFailure(msg.id);
      }
    }
  }

  /**
   * Closes the WebSocket service and performs necessary cleanup.
   * 
   * This method will:
   * - Clear the interval if it exists.
   * - Close the WebSocket server.
   * - Allow the message queue to perform any final cleanup.
   * 
   * @returns {void}
   */
  public close(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
    this.wss.close();

    // Let the queue do any final cleanup
    this.messageQueue.close();
  }
}
