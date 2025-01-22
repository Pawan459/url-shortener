import request from "supertest";
import http from 'http';
import { WebSocket } from "ws";

import { main } from "@app/server";

describe("URL Shortener API (Integration)", () => {
  let server: http.Server;
  let port: number;
  let baseURL: string;

  beforeAll(() => {
    // 1. Override PORT to 0 => ephemeral port
    const PORT = parseInt("0", 10);

    // 2. Start the server by calling main()
    const result = main(PORT);
    server = result.server;

    // 3. Determine ephemeral port assigned by the OS
    const addr = server.address();
    if (addr && typeof addr === "object" && "port" in addr) {
      port = addr.port;
    } else {
      throw new Error("Failed to get the server address.");
    }
    baseURL = `http://localhost:${port}`;

    // Now the server is listening on a random free port
  });

  // -----------------------------------------------------------
  // 1) Basic "POST /url" test with a valid URL
  // -----------------------------------------------------------
  it("should accept a valid URL and return 202", async () => {
    // The server code returns 202 for a successfully queued short URL
    const response = await request(baseURL)
      .post("/url")
      .send({ url: "https://example.com" }) // a valid URL
      .expect(202);

    // Response body might have fields like { status: "...", messageId: "..." }
    expect(response.body).toHaveProperty("status", "Shortening in progress. Check WebSocket for result.");
    expect(response.body).toHaveProperty("messageId");
  });

  // -----------------------------------------------------------
  // 2) "POST /url" with an invalid URL => expect 400 or 422
  // -----------------------------------------------------------
  it("should handle invalid URL input", async () => {
    // If your code is set up to validate and return 400,
    // we expect 400. Adjust if your actual code differs.
    await request(baseURL)
      .post("/url")
      .send({ url: "not a valid url" })
      .expect(400);
  });

  // -----------------------------------------------------------
  // 3) "POST /url" with missing URL param => 400
  // -----------------------------------------------------------
  it("should handle missing URL input", async () => {
    await request(baseURL)
      .post("/url")
      .send({})
      .expect(400);
  });

  // -----------------------------------------------------------
  // 4) GET /:code => if code is not found => 404
  // -----------------------------------------------------------
  it("should return 404 if short code is not found", async () => {
    await request(baseURL)
      .get("/nonExistentCode1234")
      .expect(404);
  });

  // -----------------------------------------------------------
  // 5) Check full flow with a WebSocket: POST => WS => GET
  // -----------------------------------------------------------
  it("should shorten a URL and deliver it via WebSocket, then GET the original", async () => {
    // 1. Connect to the WebSocket with a specific clientId
    const clientId = "testClient";
    const wsURL = `ws://localhost:${port}?clientId=${clientId}`;
    const ws = new WebSocket(wsURL);

    let deliveryMsg: any;
    // Wait for the server to "DELIVERY" the shortened URL
    const wsPromise = new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        // console.log("WebSocket connected");
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "DELIVERY") {
          deliveryMsg = msg;
          resolve();
        }
      });
      ws.on("error", reject);
      // If needed, handle "close"
    });

    // 2. Make the POST /url with clientId
    const body = { url: "https://github.com/pawan", clientId };
    const res = await request(baseURL)
      .post("/url")
      .send(body)
      .expect(202);

    expect(res.body).toHaveProperty("messageId");
    // We'll rely on the WS to get the shortenedURL

    // 3. Wait until the WebSocket "DELIVERY" message arrives
    await wsPromise;

    expect(deliveryMsg).toBeDefined();
    expect(deliveryMsg.type).toBe("DELIVERY");
    expect(deliveryMsg.payload).toHaveProperty("shortenedURL");

    const shortURL: string = deliveryMsg.payload.shortenedURL;
    // e.g. "http://localhost:3000/abcd1234"

    // 4. GET the shortened URL => expect to get original
    const shortCode = shortURL.split("/").pop();
    const getRes = await request(baseURL)
      .get(`/${shortCode}`)
      .expect(200);

    // The response body typically => { url: "https://github.com/pawan" }
    expect(getRes.body).toHaveProperty("url", "https://github.com/pawan");

    // Close the WebSocket
    ws.close();
  }, 15000); // Increase the test timeout if the WS flow can take >5s

  describe('Shutdown and Signal Handlers', () => {
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
      processExitSpy = jest.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit(${code}) called`);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should gracefully shutdown on SIGINT", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => { });

      const emitSIGINT = new Promise<void>((resolve) => {
        server.close = jest.fn((callback) => {
          console.log("Server closed.");
          resolve();
          if (callback) callback();
        }) as any;

        process.emit("SIGINT");
      });

      await emitSIGINT;

      expect(consoleSpy).toHaveBeenCalledWith("Server closed.");
      expect(processExitSpy).toHaveBeenCalledWith(130);

      consoleSpy.mockRestore();
    });

    it("should gracefully shutdown on SIGTERM", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => { });

      const emitSIGTERM = new Promise<void>((resolve) => {
        server.close = jest.fn((callback) => {
          console.log("Server closed.");
          resolve();
          if (callback) callback();
        }) as any;

        process.emit("SIGTERM");
      });

      await emitSIGTERM;

      expect(consoleSpy).toHaveBeenCalledWith("Server closed.");
      expect(processExitSpy).toHaveBeenCalledWith(130);

      consoleSpy.mockRestore();
    });

    it("should log message on process exit", () => {
      const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => { });
      const processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        console.info("Exiting");
        throw new Error("process.exit(undefined) called");
      });

      expect(() => process.exit()).toThrow("process.exit(undefined) called");
      expect(consoleSpy).toHaveBeenCalledWith("Exiting");

      // Restore mocks
      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should handle uncaughtException and shutdown", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

      const error = new Error("Test uncaught exception");
      const emitUncaughtException = new Promise<void>((resolve) => {
        server.close = jest.fn((callback) => {
          console.error("Server closed.");
          resolve();
          if (callback) callback();
        }) as any;

        process.emit("uncaughtException", error);
      });

      await emitUncaughtException;

      expect(consoleSpy).toHaveBeenCalledWith("Uncaught exception", error);
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should handle unhandledRejection and shutdown", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

      const reason = "Test unhandled rejection";
      const emitUnhandledRejection = new Promise<void>((resolve) => {
        server.close = jest.fn((callback) => {
          console.error("Server closed.");
          resolve();
          if (callback) callback();
        }) as any;

        process.emit("unhandledRejection", reason, Promise.reject(reason).catch(() => { }));
      });

      await emitUnhandledRejection;

      expect(consoleSpy).toHaveBeenCalledWith("Unhandled Rejection at promise", reason);
      expect(processExitSpy).toHaveBeenCalledWith(2);

      consoleSpy.mockRestore();
    });
  });
});
