import { PurgePolicy } from "../PurgePolicy";
import { MAX_MESSAGE_AGE_MS, MAX_DELIVERY_ATTEMPTS } from "@app/config";

const DEFAULT_MESSAGE: IMessage = {
  createdAt: Date.now(),
  retryCount: 0,
  id: "messageId",
  payload: {
    shortenedURL: "http://example.com"
  },
  clientId: "testClient",
  nextAttempt: 0
}

describe("PurgePolicy", () => {
  let purgePolicy: PurgePolicy;

  beforeEach(() => {
    purgePolicy = new PurgePolicy();
  });

  it("should return true if the message is older than maxAgeMs", () => {
    const oldMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now() - MAX_MESSAGE_AGE_MS - 1,
      retryCount: 0,
    });
    expect(purgePolicy.isExpired(oldMessage)).toBe(true);
  });

  it("should return true if the message retry count exceeds maxAttempts", () => {
    const messageWithMaxRetries = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now(),
      retryCount: MAX_DELIVERY_ATTEMPTS + 1,
    });
    expect(purgePolicy.isExpired(messageWithMaxRetries)).toBe(true);
  });

  it("should return false if the message is within maxAgeMs and retry count is within maxAttempts", () => {
    const validMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now(),
      retryCount: 0,
    });
    expect(purgePolicy.isExpired(validMessage)).toBe(false);
  });

  it("should return true if the message is exactly at maxAgeMs", () => {
    const borderlineOldMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now() - MAX_MESSAGE_AGE_MS,
      retryCount: 0,
    });
    expect(purgePolicy.isExpired(borderlineOldMessage)).toBe(true);
  });

  it("should return true if the message retry count is exactly at maxAttempts", () => {
    const borderlineRetryMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now(),
      retryCount: MAX_DELIVERY_ATTEMPTS,
    });
    expect(purgePolicy.isExpired(borderlineRetryMessage)).toBe(true);
  });

  it("should return false if the message is just below maxAgeMs and retry count is just below maxAttempts", () => {
    const almostExpiredMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now() - MAX_MESSAGE_AGE_MS + 1,
      retryCount: MAX_DELIVERY_ATTEMPTS - 1,
    });
    expect(purgePolicy.isExpired(almostExpiredMessage)).toBe(false);
  });

  it("should handle messages with createdAt in the future", () => {
    const futureMessage = Object.assign(DEFAULT_MESSAGE, {
      createdAt: Date.now() + 1000,
      retryCount: 0,
    });
    expect(purgePolicy.isExpired(futureMessage)).toBe(false);
  });
});