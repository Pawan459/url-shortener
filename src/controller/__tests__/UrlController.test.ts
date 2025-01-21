import { Request, Response } from "express";
import { Server } from "ws";

import { UrlController } from "@app/controller";
import { UrlShortenerService } from "@app/services";
import { MessageQueue, WebSocketService } from "@app/message";

jest.mock("@app/services");
jest.mock("@app/message");

describe("UrlController", () => {
  let urlShortenerService: UrlShortenerService;
  let wsService: WebSocketService;
  let urlController: UrlController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    urlShortenerService = new UrlShortenerService({} as IUrlStorage, "http://short.url");
    wsService = new WebSocketService({} as Server, {} as MessageQueue);
    urlController = new UrlController(urlShortenerService, wsService);

    req = {
      body: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe("shortenUrl", () => {
    it("should return 400 if url is missing", async () => {
      req.body = { url: "" };

      await urlController.shortenUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Missing or invalid 'url' parameter" });
    });

    it("should return 400 if clientId is not a string", async () => {
      req.body = { url: "http://example.com", clientId: 123 };

      await urlController.shortenUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "If provided, 'clientId' must be a string" });
    });

    it("should return 202 and queue message for WebSocket delivery", async () => {
      const shortenedUrl = "http://short.url/abc123";
      urlShortenerService.shortenUrl = jest.fn().mockResolvedValue(shortenedUrl);
      wsService.queueMessage = jest.fn().mockResolvedValue(undefined);

      req.body = { url: "http://example.com" };

      await urlController.shortenUrl(req as Request, res as Response);

      expect(urlShortenerService.shortenUrl).toHaveBeenCalledWith("http://example.com");
      expect(wsService.queueMessage).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "Shortening in progress. Check WebSocket for result."
      }));
    });

    it("should return 500 if an error occurs", async () => {
      const error = new Error("Test error");
      urlShortenerService.shortenUrl = jest.fn().mockRejectedValue(error);

      req.body = { url: "http://example.com" };

      await urlController.shortenUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Test error" });
    });
  });

  describe("resolveUrl", () => {
    it("should return 400 if code is missing", async () => {
      req.params = { code: "" };

      await urlController.resolveUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Short code is required" });
    });

    it("should return 404 if short code is not found", async () => {
      urlShortenerService.getOriginalUrl = jest.fn().mockResolvedValue(null);

      req.params = { code: "abc123" };

      await urlController.resolveUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Short code not found" });
    });

    it("should return the original URL if short code is found", async () => {
      const originalUrl = "http://example.com";
      urlShortenerService.getOriginalUrl = jest.fn().mockResolvedValue(originalUrl);

      req.params = { code: "abc123" };

      await urlController.resolveUrl(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({ url: originalUrl });
    });

    it("should return 500 if an error occurs", async () => {
      const error = new Error("Test error");
      urlShortenerService.getOriginalUrl = jest.fn().mockRejectedValue(error);

      req.params = { code: "abc123" };

      await urlController.resolveUrl(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Test error" });
    });
  });
});