/**
 * In-memory implementation of the IUrlStorage interface.
 * This class provides methods to store and retrieve URL mappings using in-memory storage.
 */
export class InMemoryUrlStorage implements IUrlStorage {
  private shortToOriginal: Record<string, string> = {};
  private originalToShort: Record<string, string> = {};

  /**
   * Retrieves the original URL associated with the given short code.
   * 
   * @param shortCode - The short code for which to retrieve the original URL.
   * @returns A promise that resolves to the original URL if found, or undefined if not found.
   */
  async getByShortCode(shortCode: string): Promise<string | undefined> {
    return this.shortToOriginal[shortCode];
  }

  /**
   * Stores the mapping between a short code and an original URL.
   * 
   * @param shortCode - The short code to be associated with the original URL.
   * @param originalUrl - The original URL to be associated with the short code.
   * @returns A promise that resolves when the mapping has been stored.
   */
  async set(shortCode: string, originalUrl: string): Promise<void> {
    this.shortToOriginal[shortCode] = originalUrl;
    this.originalToShort[originalUrl] = shortCode;
  }

  /**
   * Retrieves the short code associated with the given original URL.
   * 
   * @param originalUrl - The original URL for which to retrieve the short code.
   * @returns A promise that resolves to the short code if found, or undefined if not found.
   */
  async getShortCodeByOriginalUrl(originalUrl: string): Promise<string | undefined> {
    return this.originalToShort[originalUrl];
  }
}
