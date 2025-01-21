import { promises as fs } from "fs";
import path from "path";

import { AsyncQueue } from "@app/concurrency";
import { PurgePolicy } from "./PurgePolicy";

export class MessageQueue {
  private filePath: string;
  private fileQueue: AsyncQueue;  // concurrency for read/write
  private messages: Map<string, IMessage> = new Map();

  // Exponential backoff parameters
  private backoffBaseMs = 2000;
  private maxDelayMs = 30000;

  private isInitialized = false;

  private readonly purgePolicy: PurgePolicy;
  // Interval to periodically purge stale messages
  private purgeInterval: NodeJS.Timeout | null = null;

  constructor(filePath: string, fileQueue: AsyncQueue, purgePolicy = new PurgePolicy()) {
    this.filePath = path.resolve(filePath);
    this.fileQueue = fileQueue;
    this.purgePolicy = purgePolicy;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");

      const data: IPersistentQueueData = JSON.parse(raw);
      for (const msgId in data.messages) {
        const message = data.messages[msgId];

        if (message) {
          this.messages.set(msgId, message);
        }
      }
    } catch (error) {
      console.log("PersistentMessageQueue: Starting with empty or new file.");
    }

    this.isInitialized = true;
    // Start the purge interval
    this.purgeInterval = setInterval(() => {
      void this.purgeStaleMessages();
    }, 60_000); // e.g., run every 1 minute
  }

  /**
   * Add a new message to the queue and persist
   */
  public async add(messageId: string, clientId: string, payload: any): Promise<void> {
    await this.init();

    // (Optional) Dedup example: if payload is the same, we might skip
    // For a real scenario, you'd define "identical" more precisely.
    for (const m of this.messages.values()) {
      if (m.clientId === clientId && JSON.stringify(m.payload) === JSON.stringify(payload)) {
        console.log("Dedup: same payload already queued. Skipping.");
        return;
      }
    }

    const now = Date.now();
    const msg: IMessage = {
      id: messageId,
      clientId,
      payload,
      createdAt: now,
      nextAttempt: now,   // immediate attempt
      retryCount: 0
    };
    this.messages.set(messageId, msg);
    await this.saveToDisk();
  }

  /**
   * Get messages that are due for delivery
   */
  public getMessagesToSend(): IMessage[] {
    const now = Date.now();
    const result: IMessage[] = [];
    for (const msg of this.messages.values()) {
      if (now >= msg.nextAttempt) {
        result.push(msg);
      }
    }
    return result;
  }

  /**
   * Acknowledge message
   */
  public async ack(messageId: string): Promise<void> {
    if (this.messages.has(messageId)) {
      this.messages.delete(messageId);
      await this.saveToDisk();
    }
  }

  /**
   * On delivery failure, increment retryCount & schedule next attempt
   */
  public async onSendFailure(messageId: string): Promise<void> {
    const msg = this.messages.get(messageId);
    if (!msg) return;

    msg.retryCount += 1;
    const delay = Math.min(this.backoffBaseMs * (2 ** msg.retryCount), this.maxDelayMs);
    msg.nextAttempt = Date.now() + delay;

    // Update & persist
    this.messages.set(messageId, msg);
    await this.saveToDisk();
  }

  /**
   * Periodically purge messages that are stale (too old or too many retries).
   */
  private async purgeStaleMessages(): Promise<void> {
    let purged = 0;
    for (const [id, msg] of this.messages) {
      if (this.purgePolicy.isExpired(msg)) {
        this.messages.delete(id);
        purged++;
      }
    }

    if (purged > 0) {
      console.log(`Purged ${purged} stale messages.`);
      await this.saveToDisk();
    }
  }

  /**
   * Save current in-memory queue to disk
   */
  private async saveToDisk(): Promise<void> {
    await this.fileQueue.enqueue(async () => {
      const data: IPersistentQueueData = { messages: {} };
      for (const [id, msg] of this.messages.entries()) {
        data.messages[id] = msg;
      }
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    });
  }

  /**
   * Cleanup on shutdown.
   */
  public close(): void {
    if (this.purgeInterval) {
      clearInterval(this.purgeInterval);
      this.purgeInterval = null;
    }
  }
}
