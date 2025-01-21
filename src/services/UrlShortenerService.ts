/**
 * Service for shortening URLs and retrieving original URLs from short codes.
 */
export class UrlShortenerService {
  /**
   * Storage interface for URL mappings.
   */
  private storage: IUrlStorage;

  /**
   * Base URL for the shortened URLs.
   */
  private baseUrl: string;

  /**
   * Constructs a new UrlShortenerService.
   * @param storage - The storage interface for URL mappings.
   * @param baseUrl - The base URL for the shortened URLs.
   */
  constructor(storage: IUrlStorage, baseUrl: string) {
    this.storage = storage;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Shortens a given URL.
   * @param rawUrl - The original URL to be shortened.
   * @returns A promise that resolves to the shortened URL.
   */
  public async shortenUrl(rawUrl: string): Promise<string> {
    const normalizedUrl = this.normalizeUrl(rawUrl);
    const existingShortCode = await this.storage.getShortCodeByOriginalUrl(normalizedUrl);
    if (existingShortCode) {
      return `${this.baseUrl}/${existingShortCode}`;
    }
    let shortCode: string;
    do {
      shortCode = this.generateRandomCode(10);
    } while (await this.storage.getByShortCode(shortCode));
    await this.storage.set(shortCode, normalizedUrl);
    return `${this.baseUrl}/${shortCode}`;
  }

  /**
   * Retrieves the original URL for a given short code.
   * @param shortCode - The short code for the shortened URL.
   * @returns A promise that resolves to the original URL or undefined if not found.
   */
  public async getOriginalUrl(shortCode: string): Promise<string | undefined> {
    return this.storage.getByShortCode(shortCode);
  }

  /**
   * Normalizes a given URL by trimming whitespace and ensuring it has a scheme.
   * @param input - The URL to be normalized.
   * @returns The normalized URL.
   * @throws Will throw an error if the input is not a valid URL.
   */
  private normalizeUrl(input: string): string {
    const trimmed = input.trim();
    try {
      if (!/^https?:\/\//i.test(trimmed)) {
        return new URL(`http://${trimmed}`).toString();
      }
      return new URL(trimmed).toString();
    } catch (error) {
      throw new Error("Invalid URL input");
    }
  }

  /**
   * Generates a random short code of a given length.
   * @param length - The length of the short code to be generated.
   * @returns The generated short code.
   */
  private generateRandomCode(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      result += chars[idx];
    }
    return result;
  }
}
