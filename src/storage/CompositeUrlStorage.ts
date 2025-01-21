/**
 * CompositeUrlStorage is an implementation of the IUrlStorage interface that
 * combines multiple storage backends. It attempts to retrieve and store URLs
 * across all provided storage instances.
 */
export class CompositeUrlStorage implements IUrlStorage {
  /**
   * An array of IUrlStorage instances that this composite storage will use.
   */
  private storages: IUrlStorage[];

  /**
   * Constructs a new CompositeUrlStorage instance.
   * @param storages - One or more IUrlStorage instances to be used by this composite storage.
   */
  constructor(...storages: IUrlStorage[]) {
    this.storages = storages;
  }

  /**
   * Retrieves the original URL associated with the given short code by querying
   * each storage instance in sequence until a match is found.
   * @param shortCode - The short code to look up.
   * @returns A promise that resolves to the original URL if found, or undefined if not found.
   */
  public async getByShortCode(shortCode: string): Promise<string | undefined> {
    for (const storage of this.storages) {
      const result = await storage.getByShortCode(shortCode);
      if (result) return result;
    }
    return undefined;
  }

  /**
   * Stores the given short code and original URL in all storage instances in parallel.
   * @param shortCode - The short code to store.
   * @param originalUrl - The original URL to associate with the short code.
   * @returns A promise that resolves when the operation is complete.
   */
  public async set(shortCode: string, originalUrl: string): Promise<void> {
    await Promise.all(this.storages.map(async storage => {
      try {
        await storage.set(shortCode, originalUrl);
      } catch (error) {
        console.error(`Failed to set in storage: ${error}`);
      }
    }));
  }

  /**
   * Retrieves the short code associated with the given original URL by querying
   * each storage instance in sequence until a match is found.
   * @param originalUrl - The original URL to look up.
   * @returns A promise that resolves to the short code if found, or undefined if not found.
   */
  public async getShortCodeByOriginalUrl(originalUrl: string): Promise<string | undefined> {
    for (const storage of this.storages) {
      if (storage.getShortCodeByOriginalUrl) {
        const code = await storage.getShortCodeByOriginalUrl(originalUrl);
        if (code) return code;
      }
    }
    return undefined;
  }
}
