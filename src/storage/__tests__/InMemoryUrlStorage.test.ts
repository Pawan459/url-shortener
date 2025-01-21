import { InMemoryUrlStorage } from '@app/storage';

describe('InMemoryUrlStorage', () => {
  let storage: InMemoryUrlStorage;

  beforeEach(() => {
    storage = new InMemoryUrlStorage();
  });

  test('should store and retrieve original URL by short code', async () => {
    const shortCode = 'abc123';
    const originalUrl = 'https://example.com';

    await storage.set(shortCode, originalUrl);
    const retrievedUrl = await storage.getByShortCode(shortCode);

    expect(retrievedUrl).toBe(originalUrl);
  });

  test('should return undefined for non-existent short code', async () => {
    const retrievedUrl = await storage.getByShortCode('nonexistent');

    expect(retrievedUrl).toBeUndefined();
  });

  test('should store and retrieve short code by original URL', async () => {
    const shortCode = 'abc123';
    const originalUrl = 'https://example.com';

    await storage.set(shortCode, originalUrl);
    const retrievedShortCode = await storage.getShortCodeByOriginalUrl(originalUrl);

    expect(retrievedShortCode).toBe(shortCode);
  });

  test('should return undefined for non-existent original URL', async () => {
    const retrievedShortCode = await storage.getShortCodeByOriginalUrl('https://nonexistent.com');

    expect(retrievedShortCode).toBeUndefined();
  });

  test('should handle multiple URL mappings', async () => {
    const shortCode1 = 'abc123';
    const originalUrl1 = 'https://example.com';
    const shortCode2 = 'def456';
    const originalUrl2 = 'https://example.org';

    await storage.set(shortCode1, originalUrl1);
    await storage.set(shortCode2, originalUrl2);

    const retrievedUrl1 = await storage.getByShortCode(shortCode1);
    const retrievedUrl2 = await storage.getByShortCode(shortCode2);
    const retrievedShortCode1 = await storage.getShortCodeByOriginalUrl(originalUrl1);
    const retrievedShortCode2 = await storage.getShortCodeByOriginalUrl(originalUrl2);

    expect(retrievedUrl1).toBe(originalUrl1);
    expect(retrievedUrl2).toBe(originalUrl2);
    expect(retrievedShortCode1).toBe(shortCode1);
    expect(retrievedShortCode2).toBe(shortCode2);
  });

  test('should overwrite existing short code with new URL', async () => {
    const shortCode = 'abc123';
    const originalUrl1 = 'https://example.com';
    const originalUrl2 = 'https://example.org';

    await storage.set(shortCode, originalUrl1);
    await storage.set(shortCode, originalUrl2);

    const retrievedUrl = await storage.getByShortCode(shortCode);
    const retrievedShortCode1 = await storage.getShortCodeByOriginalUrl(originalUrl1);
    const retrievedShortCode2 = await storage.getShortCodeByOriginalUrl(originalUrl2);

    expect(retrievedUrl).toBe(originalUrl2);
    expect(retrievedShortCode1).toBeUndefined();
    expect(retrievedShortCode2).toBe(shortCode);
  });

  test('should handle empty short code and URL', async () => {
    const shortCode = '';
    const originalUrl = '';

    await storage.set(shortCode, originalUrl);
    const retrievedUrl = await storage.getByShortCode(shortCode);
    const retrievedShortCode = await storage.getShortCodeByOriginalUrl(originalUrl);

    expect(retrievedUrl).toBe(originalUrl);
    expect(retrievedShortCode).toBe(shortCode);
  });
});