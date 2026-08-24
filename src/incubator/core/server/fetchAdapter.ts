import { IncomingMessage, type IncomingHttpHeaders, type OutgoingHttpHeaders, type ServerResponse } from "node:http";
import { Socket } from "node:net";

export interface HttpSink {
  setHeader(name: string, value: number | string | readonly string[]): this;
  writeHead(status: number, headers?: object): this;
  end(chunk?: string): this;
}

export class FetchSink implements HttpSink {
  status = 200;
  readonly headers = new Headers();
  body = "";

  setHeader(name: string, value: number | string | readonly string[]): this {
    if (Array.isArray(value)) {
      this.headers.delete(name);
      for (const item of value) this.headers.append(name, String(item));
      return this;
    }
    this.headers.set(name, String(value));
    return this;
  }

  writeHead(status: number, headers?: object): this {
    this.status = status;
    if (headers && !Array.isArray(headers)) {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) this.setHeader(key, value.map(String));
        else this.setHeader(key, String(value));
      }
    }
    return this;
  }

  end(chunk?: string): this {
    if (chunk !== undefined) this.body = chunk;
    return this;
  }

  toResponse(): Response {
    const empty = this.status === 204 || this.status === 304;
    return new Response(empty ? null : this.body, {
      status: this.status,
      headers: this.headers,
    });
  }
}

export function nodeSink(response: ServerResponse): HttpSink {
  return {
    setHeader(name, value) {
      response.setHeader(name, value);
      return this;
    },
    writeHead(status, headers) {
      if (headers) response.writeHead(status, headers as OutgoingHttpHeaders);
      else response.writeHead(status);
      return this;
    },
    end(chunk) {
      response.end(chunk);
      return this;
    },
  };
}

export async function incomingFromFetch(request: Request): Promise<IncomingMessage> {
  const url = new URL(request.url);
  const req = new IncomingMessage(new Socket());
  req.method = request.method;
  req.url = `${url.pathname}${url.search}`;
  const headers: IncomingHttpHeaders = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  if (!headers.host) headers.host = url.host;
  req.headers = headers;
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > 0) req.push(body);
  req.push(null);
  return req;
}
