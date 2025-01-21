import { promises as fs } from "fs";

import { MessageQueue } from "@app/message";
import { AsyncQueue } from "@app/concurrency";

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.useFakeTimers();

const MOCK_FILE_PATH = "/path/to/file.json";

describe("MessageQueue", () => {
  let messageQueue: MessageQueue;
  let fileQueue: AsyncQueue;

  beforeEach(() => {
    fileQueue = new AsyncQueue();
    messageQueue = new MessageQueue(MOCK_FILE_PATH, fileQueue);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.resetAllMocks();
  });

  it("should initialize with empty file", async () => {
    (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));

    await messageQueue.init();

    expect(fs.readFile).toHaveBeenCalledWith(MOCK_FILE_PATH, "utf-8");
    expect(messageQueue["isInitialized"]).toBe(true);
  });

  it("should add a new message and persist it", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    expect(messageQueue["messages"].size).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("should get messages that are due for delivery", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });
    const messages = messageQueue.getMessagesToSend();

    expect(messages.length).toBe(1);
    expect(messages[0]?.id).toBe("msg1");
  });

  it("should acknowledge a message and remove it", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });
    await messageQueue.ack("msg1");

    expect(messageQueue["messages"].size).toBe(0);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("should handle send failure and schedule next attempt", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });
    await messageQueue.onSendFailure("msg1");

    const msg = messageQueue["messages"].get("msg1");
    expect(msg?.retryCount).toBe(1);
    expect(msg?.nextAttempt).toBeGreaterThan(Date.now());
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("should periodically purge stale messages", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    const spy = jest.spyOn(messageQueue as any, "purgeStaleMessages");

    jest.advanceTimersByTime(60_000);

    expect(spy).toHaveBeenCalled();
  });

  it("should save to disk", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    expect(fs.writeFile).toHaveBeenCalledWith(
      MOCK_FILE_PATH,
      expect.any(String),
      "utf-8"
    );
  });

  it("should not increment retryCount if message does not exist on send failure", async () => {
    await messageQueue.onSendFailure("nonexistent");

    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("should not purge messages that are not stale", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    const purgeSpy = jest.spyOn(messageQueue["purgePolicy"], "isExpired").mockReturnValue(false);

    await messageQueue["purgeStaleMessages"]();

    expect(messageQueue["messages"].size).toBe(1);
    expect(purgeSpy).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledTimes(1); // While adding the message
  });

  it("should purge messages that are stale", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    const purgeSpy = jest.spyOn(messageQueue["purgePolicy"], "isExpired").mockReturnValue(true);

    await messageQueue["purgeStaleMessages"]();

    expect(messageQueue["messages"].size).toBe(0);
    expect(purgeSpy).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("should handle multiple send failures and schedule next attempts correctly", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    await messageQueue.onSendFailure("msg1");
    let msg = messageQueue["messages"].get("msg1");
    expect(msg?.retryCount).toBe(1);
    expect(msg?.nextAttempt).toBeGreaterThan(Date.now());

    await messageQueue.onSendFailure("msg1");
    msg = messageQueue["messages"].get("msg1");
    expect(msg?.retryCount).toBe(2);
    expect(msg?.nextAttempt).toBeGreaterThan(Date.now());
    expect(fs.writeFile).toHaveBeenCalledTimes(3);
  });

  it("should not purge messages if purgePolicy is not expired", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ messages: {} }));
    await messageQueue.init();

    await messageQueue.add("msg1", "client1", { data: "test" });

    const purgeSpy = jest.spyOn(messageQueue["purgePolicy"], "isExpired").mockReturnValue(false);

    await messageQueue["purgeStaleMessages"]();

    expect(messageQueue["messages"].size).toBe(1);
    expect(purgeSpy).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledTimes(1); // While adding the message
  });

  it("should clear interval on close", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    await messageQueue.init();

    messageQueue.close();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});