/**
 * Represents the data structure for storing URL mappings.
 */
interface FileData {
  shortToOriginal: Record<string, string>;
  originalToShort: Record<string, string>;
}

/**
 * Interface for URL storage operations.
 */
interface IUrlStorage {
  /**
   * Retrieve the original URL from a short code.
   * @param shortCode - The short code associated with the original URL.
   * @returns A promise that resolves to the original URL if found, or undefined if not found.
   */
  getByShortCode(shortCode: string): Promise<string | undefined>;

  /**
   * Store the mapping from short code to original URL.
   * @param shortCode - The short code to be associated with the original URL.
   * @param originalUrl - The original URL to be stored.
   * @returns A promise that resolves when the mapping is successfully stored.
   */
  set(shortCode: string, originalUrl: string): Promise<void>;

  /**
   * Optional: Retrieve the short code if we already have a mapping for this URL.
   * (Used to avoid duplicates for the same original URL.)
   * @param originalUrl - The original URL to check for an existing short code.
   * @returns A promise that resolves to the short code if found, or undefined if not found.
   */
  getShortCodeByOriginalUrl(originalUrl: string): Promise<string | undefined>;
}
