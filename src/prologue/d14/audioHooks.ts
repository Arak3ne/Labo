import * as sound from "./d14Sound";

export function prime(): void {
  sound.prime();
}

export function shutdown(): void {
  sound.shutdown();
}

/** Arrivée → jusqu’au boot. Continu, bas, stable. */
export function idle_hum(): void {
  sound.prime();
  sound.setBed("idle", 0.8);
}

/** Chaque ligne de boot `OK`. Tick sec. */
export function boot_ok(): void {
  sound.prime();
  sound.tick();
}

/** `RÉSEAU INDISPONIBLE` + `ACCÈS REFUSÉ`. Une fois. */
export function net_denied(): void {
  sound.deny();
}

/** CTA restaurer + lignes de session. */
export function restore(): void {
  sound.servo();
}

/** `SCHÉMA NON RECONNU`. */
export function lock_fail(): void {
  sound.thud();
}

/** `SCHÉMA RECONNU`. */
export function lock_ok(): void {
  sound.unlockChord();
}

/** Bureau local — tu es rentré. */
export function desktop_in(): void {
  sound.prime();
  sound.setBed("inside", 0.9);
}

/** Détection : la ligne se dessine. */
export function detect(): void {
  sound.setBed("tension", 1.1);
  sound.detectPing();
}

/** Premier incident. */
export function incident(): void {
  sound.incident();
}

/** Fausse accalmie. */
export function false_calm(): void {
  sound.setBed("hold", 0.7);
}

/** Climax A, `CONNEXION RÉSEAU ÉTABLIE`. Coupe `idle_hum`. */
export function net_up(): void {}

/** Escalade — overlay `M.O.R.U.E.`. */
export function takeover(): void {
  sound.setBed("kill", 0.25);
  sound.alarmHit();
}

export function escalate(): void {
  sound.alarmHit();
  sound.tear();
}

/** Destruction. */
export function revoke(): void {
  sound.stutter(6);
  sound.tear();
}

export function hard_cut(): void {
  sound.hardCut();
}

export function d07_mark(): void {
  sound.d07Mark();
}
