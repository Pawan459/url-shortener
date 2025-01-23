import { promises as fs } from "fs";
import path from "path";
import { AsyncQueue } from "@app/concurrency";

/**
 * Class representing a file-based URL storage system.
 * Implements the IUrlStorage interface.
 */
export class FileUrlStorage implements IUrlStorage {
  /**
   * Path to the storage file.
   */
  private filePath: string;

  /**
   * Queue to handle asynchronous operations.
   */
  private queue: AsyncQueue;

  /**
   * Data structure to store URL mappings.
   */
  private data: FileData = { shortToOriginal: {}, originalToShort: {} };

  /**
   * Flag to check if the storage has been initialized.
   */
  private isInitialized = false;

  /**
   * Creates an instance of FileUrlStorage.
   * @param filePath - The path to the storage file.
   * @param queue - The asynchronous queue for handling operations.
   */
  constructor(filePath: string, queue: AsyncQueue) {
    this.filePath = path.resolve(filePath);
    this.queue = queue;
  }

  /**
   * Initializes the storage if it hasn't been initialized yet.
   * Reads the data from the file and parses it.
   * If the file doesn't exist or contains invalid JSON, starts with empty data.
   * @private
   */
  private async initializeIfNeeded(): Promise<void> {
    if (this.isInitialized) return;
    try {
      let raw;
      try {
        raw = await fs.readFile(this.filePath, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File doesn't exist, create directory and file with empty data
          await fs.mkdir(path.dirname(this.filePath), { recursive: true });
          await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
          raw = JSON.stringify(this.data);
        } else {
          throw error;
        }
      }
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.shortToOriginal &&
        parsed.originalToShort
      ) {
        this.data = parsed;
      }
    } catch (error) {
      // If file doesn't exist or invalid JSON, start fresh
      console.log("FileUrlStorage: Starting with empty data or new file.");
    }
    this.isInitialized = true;
  }

  /**
   * Retrieves the original URL by its short code.
   * @param shortCode - The short code of the URL.
   * @returns The original URL or undefined if not found.
   */
  public async getByShortCode(shortCode: string): Promise<string | undefined> {
    await this.initializeIfNeeded();
    return this.data.shortToOriginal[shortCode];
  }

  /**
   * Stores the short code and original URL mapping.
   * @param shortCode - The short code of the URL.
   * @param originalUrl - The original URL to be shortened.
   */
  public async set(shortCode: string, originalUrl: string): Promise<void> {
    await this.initializeIfNeeded();
    await this.queue.enqueue(async () => {
      this.data.shortToOriginal[shortCode] = originalUrl;
      this.data.originalToShort[originalUrl] = shortCode;

      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    });
  }

  /**
   * Retrieves the short code by the original URL.
   * @param originalUrl - The original URL.
   * @returns The short code or undefined if not found.
   */
  public async getShortCodeByOriginalUrl(originalUrl: string): Promise<string | undefined> {
    await this.initializeIfNeeded();
    return this.data.originalToShort[originalUrl];
  }
}
