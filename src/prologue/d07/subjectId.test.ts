import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSubjectId,
  getOrCreateSubjectId,
  isValidSubjectId,
  SUBJECT_ID_ALPHABET,
  SUBJECT_ID_KEY,
} from "./subjectId";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  } satisfies Storage;
}

describe("D-07 subject id", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates SUJ-07-XXXX from the allowed alphabet", () => {
    const id = createSubjectId();
    expect(isValidSubjectId(id)).toBe(true);
    const suffix = id.slice("SUJ-07-".length);
    expect([...suffix].every((char) => SUBJECT_ID_ALPHABET.includes(char))).toBe(true);
  });

  it("reuses the session value instead of minting a new one", () => {
    const storage = memoryStorage();
    storage.setItem(SUBJECT_ID_KEY, "SUJ-07-A2B3");
    vi.stubGlobal("sessionStorage", storage);
    expect(getOrCreateSubjectId()).toBe("SUJ-07-A2B3");
    expect(getOrCreateSubjectId()).toBe("SUJ-07-A2B3");
  });

  it("replaces an invalid stored value", () => {
    const storage = memoryStorage();
    storage.setItem(SUBJECT_ID_KEY, "SUJ-07-O0IL");
    vi.stubGlobal("sessionStorage", storage);
    const id = getOrCreateSubjectId();
    expect(isValidSubjectId(id)).toBe(true);
    expect(id).not.toBe("SUJ-07-O0IL");
    expect(storage.getItem(SUBJECT_ID_KEY)).toBe(id);
  });
});
