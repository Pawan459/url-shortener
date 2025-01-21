import { promises as fs } from "fs";
import { AsyncQueue } from "@app/concurrency";
import { FileUrlStorage } from "../FileUrlStorage";

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe("FileUrlStorage", () => {
  const filePath = "/path/to/storage.json";
  let queue: AsyncQueue;
  let storage: FileUrlStorage;

  beforeEach(() => {
    queue = new AsyncQueue();
    storage = new FileUrlStorage(filePath, queue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeIfNeeded", () => {
    it("should initialize with empty data if file does not exist", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));

      await storage["initializeIfNeeded"]();

      expect(storage["data"]).toEqual({ shortToOriginal: {}, originalToShort: {} });
      expect(storage["isInitialized"]).toBe(true);
    });

    it("should initialize with empty data if file contains invalid JSON", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue("invalid json");

      await storage["initializeIfNeeded"]();

      expect(storage["data"]).toEqual({ shortToOriginal: {}, originalToShort: {} });
      expect(storage["isInitialized"]).toBe(true);
    });

    it("should initialize with data from file if valid JSON", async () => {
      const fileData = { shortToOriginal: { "abc": "http://example.com" }, originalToShort: { "http://example.com": "abc" } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(fileData));

      await storage["initializeIfNeeded"]();

      expect(storage["data"]).toEqual(fileData);
      expect(storage["isInitialized"]).toBe(true);
    });
  });

  describe("getByShortCode", () => {
    it("should return the original URL for a given short code", async () => {
      const fileData = { shortToOriginal: { "abc": "http://example.com" }, originalToShort: { "http://example.com": "abc" } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(fileData));

      const result = await storage.getByShortCode("abc");

      expect(result).toBe("http://example.com");
    });

    it("should return undefined if short code does not exist", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ shortToOriginal: {}, originalToShort: {} }));

      const result = await storage.getByShortCode("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("set", () => {
    it("should store the short code and original URL mapping", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await storage.set("abc", "http://example.com");

      expect(storage["data"].shortToOriginal["abc"]).toBe("http://example.com");
      expect(storage["data"].originalToShort["http://example.com"]).toBe("abc");
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, JSON.stringify(storage["data"], null, 2), "utf-8");
    });

    it("should handle concurrent set operations correctly", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const promises = [
        storage.set("abc", "http://example.com"),
        storage.set("def", "http://example.org"),
      ];

      await Promise.all(promises);

      expect(storage["data"].shortToOriginal["abc"]).toBe("http://example.com");
      expect(storage["data"].shortToOriginal["def"]).toBe("http://example.org");
      expect(storage["data"].originalToShort["http://example.com"]).toBe("abc");
      expect(storage["data"].originalToShort["http://example.org"]).toBe("def");
    });
  });

  describe("getShortCodeByOriginalUrl", () => {
    it("should return the short code for a given original URL", async () => {
      const fileData = { shortToOriginal: { "abc": "http://example.com" }, originalToShort: { "http://example.com": "abc" } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(fileData));

      const result = await storage.getShortCodeByOriginalUrl("http://example.com");

      expect(result).toBe("abc");
    });

    it("should return undefined if original URL does not exist", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ shortToOriginal: {}, originalToShort: {} }));

      const result = await storage.getShortCodeByOriginalUrl("http://nonexistent.com");

      expect(result).toBeUndefined();
    });
  });
});