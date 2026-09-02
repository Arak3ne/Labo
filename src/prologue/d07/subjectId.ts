export const SUBJECT_ID_KEY = "prologue:d07:subjectId";
export const SUBJECT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SUBJECT_ID_PATTERN = /^SUJ-07-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export function isValidSubjectId(value: string): boolean {
  return SUBJECT_ID_PATTERN.test(value);
}

export function createSubjectId(): string {
  const suffix = Array.from({ length: 4 }, () => randomAlphabetChar()).join("");
  return `SUJ-07-${suffix}`;
}

export function getOrCreateSubjectId(): string {
  const stored = readStoredId();
  if (stored && isValidSubjectId(stored)) return stored;
  const created = createSubjectId();
  writeStoredId(created);
  return created;
}

function randomAlphabetChar(): string {
  const alphabet = SUBJECT_ID_ALPHABET;
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return alphabet[(bytes[0] ?? 0) % alphabet.length] ?? alphabet[0]!;
}

function readStoredId(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(SUBJECT_ID_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(value: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SUBJECT_ID_KEY, value);
  } catch {
    /* private mode / blocked storage */
  }
}
