import { MAX_MESSAGE_AGE_MS, MAX_DELIVERY_ATTEMPTS } from "@app/config";

export class PurgePolicy {
  private readonly maxAgeMs: number;
  private readonly maxAttempts: number;

  constructor(maxAgeMs = MAX_MESSAGE_AGE_MS, maxAttempts = MAX_DELIVERY_ATTEMPTS) {
    this.maxAgeMs = maxAgeMs;
    this.maxAttempts = maxAttempts;
  }

  public isExpired(msg: IMessage): boolean {
    const now = Date.now();
    // If the message is older than maxAgeMs or we've retried too many times
    const age = now - msg.createdAt;
    if (age >= this.maxAgeMs) {
      return true;
    }
    if (msg.retryCount >= this.maxAttempts) {
      return true;
    }
    return false;
  }
}
