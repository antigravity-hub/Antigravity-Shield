/**
 * Test Context Manager for Antigravity Shield API Proxy E2E
 */

import { MockUpstreamServer } from './mock_upstream.mjs';
import { ProxyGateway } from './proxy_gateway.mjs';

export class TestContext {
  constructor(options = {}) {
    this.mockUpstream = new MockUpstreamServer();
    this.proxyGateway = null;
    this.gatewayUrl = '';
    this.upstreamUrl = '';
    this.options = options;
  }

  async setup() {
    this.upstreamUrl = await this.mockUpstream.start();
    this.proxyGateway = new ProxyGateway({
      upstreamBaseUrl: this.upstreamUrl,
      ...this.options
    });
    this.gatewayUrl = await this.proxyGateway.start();
  }

  async teardown() {
    if (this.proxyGateway) {
      await this.proxyGateway.stop();
    }
    if (this.mockUpstream) {
      await this.mockUpstream.stop();
    }
  }

  async request(path, options = {}) {
    const url = `${this.gatewayUrl}${path}`;
    const res = await fetch(url, options);
    let body = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else if (contentType.includes('text/event-stream')) {
      // streaming handled separately via consumeSSE
      body = null;
    } else {
      body = await res.text();
    }
    return { res, body };
  }

  async consumeSSE(path, options = {}) {
    const url = `${this.gatewayUrl}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.text();
      return { res, events: [], chunks: [], error: errBody };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    const events = [];

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // incomplete line

      let currentEvent = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            events.push({ event: currentEvent || 'done', data: '[DONE]' });
            continue;
          }
          try {
            const parsed = JSON.parse(dataStr);
            chunks.push(parsed);
            events.push({ event: currentEvent || 'message', data: parsed });
          } catch {
            events.push({ event: currentEvent || 'message', raw: dataStr });
          }
        }
      }
    }

    return { res, events, chunks };
  }
}
