import http from 'node:http';
import { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
  timestamp: number;
}

export type HandlerFn = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: string,
  record: RecordedRequest
) => boolean | Promise<boolean>;

export class MockUpstreamServer {
  private server: http.Server | null = null;
  public port: number = 0;
  public baseUrl: string = '';
  public recordedRequests: RecordedRequest[] = [];
  private customHandlers: HandlerFn[] = [];

  constructor() {}

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          const recorded: RecordedRequest = {
            method: req.method || 'GET',
            url: req.url || '/',
            headers: req.headers,
            body,
            timestamp: Date.now(),
          };
          this.recordedRequests.push(recorded);

          // Check custom handlers
          for (const handler of this.customHandlers) {
            try {
              const handled = await handler(req, res, body, recorded);
              if (handled) return;
            } catch (err) {
              console.error('Mock upstream handler error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Internal mock server error' }));
              return;
            }
          }

          // Default handler for Google v1internal endpoints
          if (req.url?.includes('/v1internal:generateContent') || req.url?.includes('/v1internal:streamGenerateContent')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Mock upstream response' }],
                    role: 'model'
                  },
                  finishReason: 'STOP'
                }
              ]
            }));
            return;
          }

          // Default fallback
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', url: req.url }));
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        this.baseUrl = 'http://127.0.0.1:' + this.port;
        resolve(this.baseUrl);
      });

      this.server.on('error', reject);
    });
  }

  public registerHandler(handler: HandlerFn): void {
    this.customHandlers.unshift(handler); // higher priority
  }

  public clearHandlers(): void {
    this.customHandlers = [];
  }

  public clearRecorded(): void {
    this.recordedRequests = [];
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        if ((this.server as any).closeAllConnections) { (this.server as any).closeAllConnections(); } this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
