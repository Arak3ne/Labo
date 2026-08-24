import { createHmac, timingSafeEqual } from "node:crypto";

export function createSessionToken(playerId: string, expiresAt: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ playerId, exp: expiresAt }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function playerIdFromSessionToken(
  token: string,
  secret: string,
  now: number,
): string | undefined {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return undefined;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !parsed
      || typeof parsed !== "object"
      || typeof (parsed as { playerId?: unknown }).playerId !== "string"
      || typeof (parsed as { exp?: unknown }).exp !== "number"
    ) {
      return undefined;
    }
    const session = parsed as { playerId: string; exp: number };
    if (session.exp <= now || session.playerId.length === 0) return undefined;
    return session.playerId;
  } catch {
    return undefined;
  }
}
