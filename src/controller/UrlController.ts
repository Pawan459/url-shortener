import { Request, Response } from "express";
import { WebSocketService } from "@app/message";
import { UrlShortenerService } from "@app/services";

export class UrlController {
  private urlShortener: UrlShortenerService;
  private wsService: WebSocketService;

  constructor(urlShortener: UrlShortenerService, wsService: WebSocketService) {
    this.urlShortener = urlShortener;
    this.wsService = wsService;
  }

  public shortenUrl = async (req: Request, res: Response) => {
    try {
      const { url, clientId } = req.body;

      if (typeof url !== "string" || !url) {
        res.status(400).json({ error: "Missing or invalid 'url' parameter" });
        return;
      }
      // clientId is optional, but if present must be a string
      if (clientId && typeof clientId !== "string") {
        res.status(400).json({ error: "If provided, 'clientId' must be a string" });
        return;
      }

      // 1. Shorten
      const shortenedUrl = await this.urlShortener.shortenUrl(url);

      // 2. Queue message for WebSocket delivery
      const msgId = `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const targetClientId = clientId || "broadcast";
      await this.wsService.queueMessage(msgId, targetClientId, {
        shortenedURL: shortenedUrl
      });

      // 3. Return 202 or 200 indicating async delivery
      res.status(202).json({
        status: "Shortening in progress. Check WebSocket for result.",
        messageId: msgId
      });

      return;
    } catch (error) {
      console.error("shortenUrl controller error:", error);
      const errMsg = (error instanceof Error) ? error.message : "Unknown error";
      if (errMsg === "Invalid URL input") {
        res.status(400).json({ error: "Invalid URL." });
        return;
      }

      res.status(500).json({ error: errMsg });
      return;
    }
  };

  public resolveUrl = async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      if (!code) {
        res.status(400).json({ error: "Short code is required" });
        return;
      }

      const originalUrl = await this.urlShortener.getOriginalUrl(code);
      if (!originalUrl) {
        res.status(404).json({ error: "Short code not found" });
        return;
      }

      res.json({ url: originalUrl });
      return;
    } catch (error) {
      console.error("resolveUrl controller error:", error);
      const errMsg = (error instanceof Error) ? error.message : "Unknown error";

      res.status(500).json({ error: errMsg });
      return;
    }
  };
}
