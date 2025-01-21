interface IMessagePayload {
  shortenedURL: string;
}

interface IMessage {
  id: string;                   // Unique message ID
  payload: IMessagePayload;     // The payload (here: { shortenedURL: string })
  clientId: string;            // Optional if we want a 1:1 mapping with specific clients
  createdAt: number;       // When was this message created?
  nextAttempt: number;     // Timestamp when we should attempt to deliver next
  retryCount: number;      // How many times we've retried sending this message
}

interface IPersistentQueueData {
  messages: Record<string, IMessage>;
  // Keyed by message ID for quick lookup
}