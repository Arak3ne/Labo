import type {
  IncomingHttpHeaders,
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";
import { Readable } from "node:stream";

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

function methodCarriesBody(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH";
}

export function isFetchRequest(value: unknown): value is Request {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { arrayBuffer?: unknown; headers?: { get?: unknown } };
  return typeof candidate.arrayBuffer === "function" && typeof candidate.headers?.get === "function";
}

export async function incomingFromFetch(request: Request): Promise<IncomingMessage> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const body = methodCarriesBody(method)
    ? Buffer.from(await request.arrayBuffer())
    : Buffer.alloc(0);
  const chunks = body.length > 0 ? [body] : [];
  const readable = Readable.from(chunks);
  const headers: IncomingHttpHeaders = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  if (!headers.host) headers.host = url.host;
  const forwarded = headerValue(headers["x-forwarded-for"]);
  Object.assign(readable, {
    method,
    url: `${url.pathname}${url.search}`,
    headers,
    complete: true,
    socket: {
      remoteAddress: forwarded ?? "127.0.0.1",
      destroy() {},
    },
  });
  return readable as IncomingMessage;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return raw.split(",")[0]?.trim() || undefined;
}
