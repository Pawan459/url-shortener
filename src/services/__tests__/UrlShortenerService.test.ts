import { UrlShortenerService } from '@app/services';

describe('UrlShortenerService', () => {
  let storage: IUrlStorage;
  let service: UrlShortenerService;
  const baseUrl = 'http://short.url';

  beforeEach(() => {
    storage = {
      getShortCodeByOriginalUrl: jest.fn(),
      getByShortCode: jest.fn(),
      set: jest.fn(),
    };
    service = new UrlShortenerService(storage, baseUrl);
  });

  describe('shortenUrl', () => {
    it('should return existing short code if URL is already shortened', async () => {
      const rawUrl = 'http://example.com';
      const shortCode = 'abc123';
      (storage.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(shortCode);

      const result = await service.shortenUrl(rawUrl);

      const expectedNormalizedUrl = `${rawUrl}/`;

      expect(result).toBe(`${baseUrl}/${shortCode}`);
      expect(storage.getShortCodeByOriginalUrl).toHaveBeenCalledWith(expectedNormalizedUrl);
    });

    it('should generate a new short code if URL is not already shortened', async () => {
      const rawUrl = 'http://example.com';
      (storage.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(undefined);
      (storage.getByShortCode as jest.Mock).mockResolvedValue(undefined);

      const result = await service.shortenUrl(rawUrl);

      expect(result).toMatch(new RegExp(`^${baseUrl}/[a-zA-Z0-9]{10}$`));
      expect(storage.set).toHaveBeenCalled();
    });

    it('should normalize the URL before shortening', async () => {
      const rawUrl = 'example.com';
      const normalizedUrl = 'http://example.com/';
      (storage.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(undefined);
      (storage.getByShortCode as jest.Mock).mockResolvedValue(undefined);

      await service.shortenUrl(rawUrl);

      expect(storage.set).toHaveBeenCalledWith(expect.any(String), normalizedUrl);
    });

    it('should throw an error for invalid URLs', async () => {
      const rawUrl = 'invalid url example';

      await expect(service.shortenUrl(rawUrl)).rejects.toThrow('Invalid URL input');
    });
  });

  describe('getOriginalUrl', () => {
    it('should return the original URL for a given short code', async () => {
      const shortCode = 'abc123';
      const originalUrl = 'http://example.com';
      (storage.getByShortCode as jest.Mock).mockResolvedValue(originalUrl);

      const result = await service.getOriginalUrl(shortCode);

      expect(result).toBe(originalUrl);
      expect(storage.getByShortCode).toHaveBeenCalledWith(shortCode);
    });

    it('should return undefined if short code is not found', async () => {
      const shortCode = 'abc123';
      (storage.getByShortCode as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getOriginalUrl(shortCode);

      expect(result).toBeUndefined();
      expect(storage.getByShortCode).toHaveBeenCalledWith(shortCode);
    });
  });
});