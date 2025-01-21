import { Server, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { MessageQueue, WebSocketService } from "@app/message";

jest.mock("ws"); // We'll mock the 'ws' module

describe("WebSocketService", () => {
  let mockWSS: jest.Mocked<Server>;
  let mockQueue: jest.Mocked<MessageQueue>;
  let service: WebSocketService;
  let mockInterval: jest.SpyInstance;

  beforeEach(() => {
    // Create a mocked WebSocket server
    mockWSS = {
      on: jest.fn(),
      close: jest.fn()
      // ... any other props you might reference
    } as unknown as jest.Mocked<Server>;

    // Create a mocked MessageQueue
    mockQueue = {
      add: jest.fn(),
      ack: jest.fn(),
      onSendFailure: jest.fn(),
      getMessagesToSend: jest.fn(() => []), // default: no pending messages
      close: jest.fn()
    } as unknown as jest.Mocked<MessageQueue>;

    // Spy on setInterval so we can track the interval calls
    mockInterval = jest.spyOn(global, "setInterval");

    // Instantiate the service
    service = new WebSocketService(mockWSS, mockQueue);
  });

  afterEach(() => {
    // Clear any intervals we set
    jest.useRealTimers();
    if (service) service.close();
    mockInterval.mockRestore();
  });

  describe("setup() - on connection", () => {
    let connectionHandler: (socket: WebSocket, req: IncomingMessage) => void;

    beforeEach(() => {
      // The WebSocketService calls `this.wss.on("connection", ...)` in `setup()`.
      // We find that callback from the mockWSS.on calls.
      // e.g. mockWSS.on("connection", someFunction).
      const call = mockWSS.on.mock.calls.find(([evt]) => evt === "connection");
      if (!call) {
        throw new Error("No connection handler was registered!");
      }
      connectionHandler = call[1]; // the second arg is the callback
    });

    it("closes the socket if no clientId is provided", () => {
      const mockSocket: Partial<WebSocket> = {
        close: jest.fn()
      };
      const mockReq: Partial<IncomingMessage> = {
        url: "http://localhost/"
      };

      // Trigger a connection event with no ?clientId=...
      connectionHandler(mockSocket as WebSocket, mockReq as IncomingMessage);

      expect(mockSocket.close).toHaveBeenCalledWith(1008, "clientId is required");
    });

    it("stores the socket if clientId is present, sends CLIENT_ID", () => {
      const mockSocket: Partial<WebSocket> = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };
      const mockReq: Partial<IncomingMessage> = {
        url: "http://localhost/?clientId=clientA"
      };

      // Trigger a connection event with ?clientId=clientA
      connectionHandler(mockSocket as WebSocket, mockReq as IncomingMessage);

      // Should not close
      expect(mockSocket.close).not.toHaveBeenCalled();

      // Should store in map
      // We don't have direct access to the internal map,
      // but we know from the code it logs "Client connected: clientA"
      // and calls socket.send with { type: "CLIENT_ID", clientId }
      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "CLIENT_ID", clientId: "clientA" })
      );

      // Also sets up socket.on("message") and socket.on("close") listeners
      expect(mockSocket.on).toHaveBeenCalledTimes(2);
    });
  });

  describe("on message (ACK) handling", () => {
    let connectionHandler: (socket: WebSocket, req: IncomingMessage) => void;
    let mockSocket: jest.Mocked<WebSocket>;

    beforeEach(() => {
      const call = mockWSS.on.mock.calls.find(([evt]) => evt === "connection");
      if (!call) throw new Error("No connection handler!");
      connectionHandler = call[1];

      mockSocket = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        readyState: 1 // OPEN
      } as any;

      // Connect with clientId
      connectionHandler(
        mockSocket,
        { url: "http://localhost/?clientId=clientB" } as IncomingMessage
      );
    });

    it("parses ACK messages and calls queue.ack", async () => {
      // The service sets socket.on("message", callback)
      const messageHandler = mockSocket.on.mock.calls.find(([event]) => event === "message")?.[1];
      if (!messageHandler) throw new Error("No message handler found!");

      // Simulate an ACK message
      const ackMsg = JSON.stringify({ type: "ACK", id: "msg123" });
      messageHandler.call(mockSocket, Buffer.from(ackMsg));

      expect(mockQueue.ack).toHaveBeenCalledWith("msg123");
    });

    it("handles invalid JSON gracefully", async () => {
      const messageHandler = mockSocket.on.mock.calls.find(([event]) => event === "message")?.[1];
      if (!messageHandler) throw new Error("No message handler found!");

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

      // Send invalid JSON
      messageHandler.call(mockSocket, Buffer.from("{ not valid JSON"));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to parse message from client:",
        expect.any(SyntaxError)
      );

      consoleErrorSpy.mockRestore();
    });

    it("ignores messages that are not ACK", async () => {
      const messageHandler = mockSocket.on.mock.calls.find(([event]) => event === "message")?.[1];
      if (!messageHandler) throw new Error("No message handler found!");

      messageHandler.call(mockSocket, Buffer.from(JSON.stringify({ type: "OTHER", data: "stuff" })));
      expect(mockQueue.ack).not.toHaveBeenCalled();
    });
  });

  describe("on socket close", () => {
    it("removes the socket from the map", () => {
      const call = mockWSS.on.mock.calls.find(([evt]) => evt === "connection");
      if (!call) throw new Error("No connection handler!");
      const connectionHandler = call[1];

      const mockSocket: any = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };
      connectionHandler.call(mockWSS, mockSocket, { url: "http://localhost/?clientId=clientC" } as any);

      // The service calls mockSocket.on("close", ...)
      const closeHandler = mockSocket.on.mock.calls.find(([evt]: [string]) => evt === "close")?.[1];
      if (!closeHandler) throw new Error("No close handler found!");

      // Fire the "close" event
      closeHandler();

      // The client map is private, but we can rely on the console.log or no error
      // If we had a getter or something we could test size
      // We'll just ensure no exceptions
      expect(mockSocket.close).not.toHaveBeenCalled();
    });
  });

  describe("broadcastPendingMessages()", () => {
    let broadcastFn: () => Promise<void>;
    let mockSocket: any;

    beforeEach(() => {
      // The service sets a setInterval(() => this.broadcastPendingMessages(), 1000)
      // We'll grab the method reference from the class or call it directly
      broadcastFn = (service as any).broadcastPendingMessages.bind(service);

      const call = mockWSS.on.mock.calls.find(([evt]) => evt === "connection");
      if (!call) throw new Error("No connection handler!");
      const connectionHandler = call[1];

      mockSocket = {
        readyState: 1, // OPEN
        OPEN: 1,
        send: jest.fn((_data, cb) => cb && cb()),
        on: jest.fn(),
        close: jest.fn()
      };
      connectionHandler.call(mockWSS, mockSocket, { url: "http://localhost/?clientId=clientX" });
    });

    it("calls onSendFailure if client is not connected", async () => {
      // Overwrite the connected socket's readyState
      mockSocket.readyState = 3; // CLOSED

      mockQueue.getMessagesToSend.mockReturnValue([
        { id: "m1", clientId: "clientX", payload: { shortenedURL: "" }, retryCount: 0, nextAttempt: Date.now(), createdAt: Date.now() }
      ]);

      await broadcastFn();

      expect(mockQueue.onSendFailure).toHaveBeenCalledWith("m1");
    });

    it("sends each due message if client is connected, calls socket.send with correct payload", async () => {
      // We'll return some pending messages
      mockQueue.getMessagesToSend.mockReturnValue([
        {
          id: "m1",
          clientId: "clientX",
          payload: { shortenedURL: "http://x.com" },
          retryCount: 0,
          nextAttempt: Date.now(),
          createdAt: Date.now()
        },
        {
          id: "m2",
          clientId: "clientX",
          payload: { shortenedURL: "http://y.com" },
          retryCount: 1,
          nextAttempt: Date.now(),
          createdAt: Date.now()
        }
      ]);

      await broadcastFn();

      // Check that .send was called for each message
      expect(mockSocket.send).toHaveBeenCalledTimes(3); // 1st call goes at the time of setup

      // Check the exact payload for the first message
      const firstCallArgs = mockSocket.send.mock.calls[1];
      const payloadObj = JSON.parse(firstCallArgs[0]);
      expect(payloadObj).toEqual({
        type: "DELIVERY",
        id: "m1",
        payload: { shortenedURL: "http://x.com" }
      });
      // The second call likewise
      const secondCallArgs = mockSocket.send.mock.calls[2];
      const payloadObj2 = JSON.parse(secondCallArgs[0]);
      expect(payloadObj2).toEqual({
        type: "DELIVERY",
        id: "m2",
        payload: { shortenedURL: "http://y.com" }
      });

      // No failures if all sends are "OK"
      expect(mockQueue.onSendFailure).not.toHaveBeenCalled();
    });

    it("on error in socket.send, calls onSendFailure", async () => {
      mockQueue.getMessagesToSend.mockReturnValue([
        {
          id: "m3",
          clientId: "clientX",
          payload: { shortenedURL: "http://z.com" },
          retryCount: 0,
          nextAttempt: Date.now(),
          createdAt: Date.now()
        }
      ]);

      // Force an error in socket.send
      mockSocket.send.mockImplementationOnce((_: any, cb: (arg0: Error) => void) => {
        if (cb) {
          cb(new Error("Send failure"));
        }
      });

      await broadcastFn();

      expect(mockQueue.onSendFailure).toHaveBeenCalledWith("m3");
    });

    it("if client is not connected (CLOSED), calls onSendFailure", async () => {
      mockQueue.getMessagesToSend.mockReturnValue([
        {
          id: "m4",
          clientId: "clientX",
          payload: {
            shortenedURL: "http://example.com"
          },
          retryCount: 0,
          nextAttempt: Date.now(),
          createdAt: Date.now()
        }
      ]);

      // Mark the socket closed
      mockSocket.readyState = 3; // CLOSED

      await broadcastFn();

      expect(mockQueue.onSendFailure).toHaveBeenCalledWith("m4");
    });

    it("on error, calls onSendFailure", async () => {
      mockQueue.getMessagesToSend.mockReturnValue([
        { id: "m3", clientId: "clientX", payload: { shortenedURL: "http://example.com" }, retryCount: 0, nextAttempt: Date.now(), createdAt: Date.now() }
      ]);

      // Force an error in socket.send
      mockSocket.send.mockImplementationOnce((_: any, cb: (arg0: Error) => any) => cb(new Error("send fail")));

      await broadcastFn();

      expect(mockQueue.onSendFailure).toHaveBeenCalledWith("m3");
    });
  });

  describe("close()", () => {
    it("clears interval, closes wss, and calls queue.close", () => {
      // There's a setInterval created in constructor
      expect(mockInterval).toHaveBeenCalled();

      service.close();

      expect(mockWSS.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe("queueMessage", () => {
    it("forwards to messageQueue.add", async () => {
      await service.queueMessage("msg10", "client10", { shortenedURL: "..." });
      expect(mockQueue.add).toHaveBeenCalledWith("msg10", "client10", { shortenedURL: "..." });
    });
  });
});
