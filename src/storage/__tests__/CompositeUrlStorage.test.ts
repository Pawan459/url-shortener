import { CompositeUrlStorage } from '@app/storage';

describe('CompositeUrlStorage', () => {
  let storage1: IUrlStorage;
  let storage2: IUrlStorage;
  let compositeStorage: CompositeUrlStorage;

  beforeEach(() => {
    storage1 = {
      getByShortCode: jest.fn(),
      set: jest.fn(),
      getShortCodeByOriginalUrl: jest.fn(),
    };
    storage2 = {
      getByShortCode: jest.fn(),
      set: jest.fn(),
      getShortCodeByOriginalUrl: jest.fn(),
    };
    compositeStorage = new CompositeUrlStorage(storage1, storage2);
  });

  describe('getByShortCode', () => {
    it('should return the URL from the first storage that has it', async () => {
      (storage1.getByShortCode as jest.Mock).mockResolvedValue(undefined);
      (storage2.getByShortCode as jest.Mock).mockResolvedValue('http://example.com');

      const result = await compositeStorage.getByShortCode('abc123');

      expect(result).toBe('http://example.com');
      expect(storage1.getByShortCode).toHaveBeenCalledWith('abc123');
      expect(storage2.getByShortCode).toHaveBeenCalledWith('abc123');
    });

    it('should return undefined if no storage has the URL', async () => {
      (storage1.getByShortCode as jest.Mock).mockResolvedValue(undefined);
      (storage2.getByShortCode as jest.Mock).mockResolvedValue(undefined);

      const result = await compositeStorage.getByShortCode('abc123');

      expect(result).toBeUndefined();
      expect(storage1.getByShortCode).toHaveBeenCalledWith('abc123');
      expect(storage2.getByShortCode).toHaveBeenCalledWith('abc123');
    });
  });

  describe('set', () => {
    it('should store the URL in all storages', async () => {
      await compositeStorage.set('abc123', 'http://example.com');

      expect(storage1.set).toHaveBeenCalledWith('abc123', 'http://example.com');
      expect(storage2.set).toHaveBeenCalledWith('abc123', 'http://example.com');
    });

    it('should handle errors in one storage gracefully', async () => {
      (storage1.set as jest.Mock).mockRejectedValue(new Error('Storage error'));
      (storage2.set as jest.Mock).mockResolvedValue(undefined);

      await expect(compositeStorage.set('abc123', 'http://example.com')).resolves.not.toThrow();

      expect(storage1.set).toHaveBeenCalledWith('abc123', 'http://example.com');
      expect(storage2.set).toHaveBeenCalledWith('abc123', 'http://example.com');
    });
  });

  describe('getShortCodeByOriginalUrl', () => {
    it('should return the short code from the first storage that has it', async () => {
      (storage1.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(undefined);
      (storage2.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue('abc123');

      const result = await compositeStorage.getShortCodeByOriginalUrl('http://example.com');

      expect(result).toBe('abc123');
      expect(storage1.getShortCodeByOriginalUrl).toHaveBeenCalledWith('http://example.com');
      expect(storage2.getShortCodeByOriginalUrl).toHaveBeenCalledWith('http://example.com');
    });

    it('should return undefined if no storage has the short code', async () => {
      (storage1.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(undefined);
      (storage2.getShortCodeByOriginalUrl as jest.Mock).mockResolvedValue(undefined);

      const result = await compositeStorage.getShortCodeByOriginalUrl('http://example.com');

      expect(result).toBeUndefined();
      expect(storage1.getShortCodeByOriginalUrl).toHaveBeenCalledWith('http://example.com');
      expect(storage2.getShortCodeByOriginalUrl).toHaveBeenCalledWith('http://example.com');
    });
  });
});