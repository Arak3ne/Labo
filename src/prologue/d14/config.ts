/**
 * Terminal D-14 — constantes de rythme.
 *
 * Le schéma d’accès n’est pas stocké ici. Voir `sealed.ts`.
 *
 * DEV (`import.meta.env.DEV` uniquement) — query string :
 *   /terminal/D-14?d14=desktop  → saute à l’environnement local (après lock)
 *   /terminal/D-14?d14=climax   → saute au début de la détection (scène film)
 * En production ces paramètres sont ignorés.
 */

export const DELAY_BEFORE_DETECTION_MS = 180;

export const CTA_ARM_MS = 180;
export const BOOT_LINE_MS = 280;
export const BOOT_FAIL_LINE_MS = 400;
export const BOOT_HOLD_DEAD_MS = 1200;
export const RECOVERY_LINE_MS = 200;
export const RESTORE_MS = 1400;
export const LOCK_FAIL_HOLD_MS = 700;
export const LOCK_FAILS_BEFORE_COOLDOWN = 3;
export const LOCK_COOLDOWN_MS = 60_000;
export const LOCK_OK_HOLD_MS = 100;
export const ENV_RESTORE_MS = 800;
/** Dump de déverrouillage : serré, puis hold. */
export const UNLOCK_LINE_AT_MS = [20, 80, 160] as const;
/** Montée — la ligne d’anomalie se dessine lentement. */
export const ANOMALY_LINE_MS = 200;
/** Premier incident. */
export const CLIMAX_A_MS = 600;
/** Fausse accalmie. */
export const CLIMAX_HOLD_MS = 600;
/** Escalade. */
export const CLIMAX_B_MS = 2500;
export const CLIMAX_C_MS = 2500;
/** Point de non-retour + extinction CRT. */
export const CLIMAX_D_MS = 9000;
export const CLIMAX_E_MS = 1600;
export const VOID_HOLD_MS = 1400;
export const REDUCED_MOTION_CUT_MS = 80;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const FILE_NOTICE_MS = 1000;

export type D14DevSkip = "desktop" | "climax";

export function parseD14Skip(search: string): D14DevSkip | null {
  const value = new URLSearchParams(search).get("d14");
  if (value === "desktop" || value === "climax") return value;
  return null;
}

export function readD14DevSkip(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  isDev: boolean = import.meta.env.DEV,
): D14DevSkip | null {
  if (!isDev) return null;
  return parseD14Skip(search);
}

export { patternsMatch } from "./sealed";
