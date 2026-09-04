export interface D14OkBody {
  ok: boolean;
}

function jsonOk(ok: boolean): Response {
  return new Response(JSON.stringify({ ok }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isIntInRange(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 8;
}

export function isValidPattern(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length > 9) return false;
  const seen = new Set<number>();
  for (const item of value) {
    if (!isIntInRange(item) || seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

export function parseExpectedPattern(raw: string | undefined): number[] | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isValidPattern(parsed) ? parsed : null;
  } catch {
    const parts = trimmed.split(",").map((part) => part.trim());
    const nums = parts.map((part) => Number(part));
    return isValidPattern(nums) ? nums : null;
  }
}

function timingSafeSame(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function timingSafeEqual(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) return false;
  let mix = 0;
  for (let i = 0; i < left.length; i += 1) {
    mix |= left[i]! ^ right[i]!;
  }
  return mix === 0;
}

export function patternMatchesExpected(
  pattern: unknown,
  expectedRaw: string | undefined = process.env.D14_PATTERN,
): boolean {
  if (!isValidPattern(pattern)) return false;
  const expected = parseExpectedPattern(expectedRaw);
  if (!expected || expected.length !== pattern.length) return false;
  return timingSafeSame(pattern.join(","), expected.join(","));
}

export function hostMatchesExpected(
  host: unknown,
  expectedRaw: string | undefined = process.env.D14_HOST,
): boolean {
  if (typeof host !== "string" || expectedRaw === undefined) return false;
  const expected = expectedRaw.trim().toLowerCase();
  if (!expected) return false;
  return timingSafeSame(host.trim().toLowerCase(), expected);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleValidatePattern(request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonOk(false);
  const body = await readJson(request);
  const pattern =
    body && typeof body === "object" && "pattern" in body
      ? (body as { pattern: unknown }).pattern
      : undefined;
  return jsonOk(patternMatchesExpected(pattern));
}

export async function handleValidateHost(request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonOk(false);
  const body = await readJson(request);
  const host =
    body && typeof body === "object" && "host" in body
      ? (body as { host: unknown }).host
      : undefined;
  return jsonOk(hostMatchesExpected(host));
}
