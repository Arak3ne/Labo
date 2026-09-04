function isOkBody(value: unknown): value is { ok: true } {
  return Boolean(value) && typeof value === "object" && (value as { ok?: unknown }).ok === true;
}

async function postOk(url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return false;
    return isOkBody(await response.json());
  } catch {
    return false;
  }
}

export function requestPatternValidation(pattern: readonly number[]): Promise<boolean> {
  return postOk("/api/validate-pattern", { pattern: [...pattern] });
}

export function requestHostValidation(host: string): Promise<boolean> {
  return postOk("/api/validate-host", { host });
}
