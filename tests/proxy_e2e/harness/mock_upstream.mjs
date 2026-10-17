/**
 * Mock Upstream Server simulating Google Cloud Code (cloudcode-pa.googleapis.com)
 *
 * Implements Google v1internal endpoints:
 * - :generateContent (POST)
 * - :streamGenerateContent?alt=sse (POST)
 */

import http from 'node:http';

export class MockUpstreamServer {
  constructor() {
    this.server = null;
    this.port = 0;
    this.baseUrl = '';
    this.recordedRequests = [];
    this.handlers = [];
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          let parsedBody = null;
          try {
            parsedBody = bodyStr ? JSON.parse(bodyStr) : null;
          } catch {
            parsedBody = bodyStr;
          }

          const record = {
            method: req.method || 'GET',
            url: req.url || '/',
            headers: req.headers,
            rawBody: bodyStr,
            body: parsedBody,
            timestamp: Date.now()
          };
          this.recordedRequests.push(record);

          // Check custom scenario handlers first
          for (const handler of this.handlers) {
            try {
              const handled = await handler(req, res, record);
              if (handled) return;
            } catch (err) {
              console.error('[MockUpstream] Custom handler error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: { message: 'Mock handler exception' } }));
              return;
            }
          }

          // Default streaming handler
          if (req.url?.includes(':streamGenerateContent')) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            });

            // If prompt requests thinking or tools, emit appropriate chunks
            const parts = parsedBody?.contents?.[0]?.parts || [];
            const promptText = parts.map(p => p.text || '').join(' ');

            if (promptText.includes('thinking_request')) {
              const chunk1 = JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ thought: true, text: 'Detailed reasoning step...' }],
                    role: 'model'
                  }
                }]
              });
              res.write(`data: ${chunk1}\n\n`);
            }

            if (promptText.includes('tool_request')) {
              const toolChunk = JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{
                      functionCall: {
                        name: 'read_file',
                        args: { path: 'src/main.rs' }
                      }
                    }],
                    role: 'model'
                  }
                }]
              });
              res.write(`data: ${toolChunk}\n\n`);
            }

            const chunkFinal = JSON.stringify({
              candidates: [{
                content: {
                  parts: [{ text: 'Here is the response from Antigravity mock model.' }],
                  role: 'model'
                },
                finishReason: 'STOP'
              }],
              usageMetadata: {
                promptTokenCount: 25,
                candidatesTokenCount: 42,
                totalTokenCount: 67
              }
            });
            res.write(`data: ${chunkFinal}\n\n`);
            res.end();
            return;
          }

          // Default non-streaming handler
          if (req.url?.includes(':generateContent')) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              candidates: [{
                content: {
                  parts: [{ text: 'Antigravity Shield test completion response.' }],
                  role: 'model'
                },
                finishReason: 'STOP'
              }],
              usageMetadata: {
                promptTokenCount: 15,
                candidatesTokenCount: 20,
                totalTokenCount: 35
              }
            }));
            return;
          }

          // Fallback 404
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `Endpoint not found: ${req.url}` } }));
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve(this.baseUrl);
      });

      this.server.on('error', reject);
    });
  }

  registerHandler(handler) {
    this.handlers.unshift(handler);
  }

  clearHandlers() {
    this.handlers = [];
  }

  clearRecorded() {
    this.recordedRequests = [];
  }

  async stop() {
    return new Promise(resolve => {
      if (this.server) {
        if (typeof this.server.closeAllConnections === 'function') {
          this.server.closeAllConnections();
        }
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
