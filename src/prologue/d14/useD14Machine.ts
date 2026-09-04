import { getCurrentInstance, onUnmounted, ref } from "vue";
import * as audio from "./audioHooks";
import {
  ANOMALY_LINE_MS,
  BOOT_FAIL_LINE_MS,
  BOOT_HOLD_DEAD_MS,
  BOOT_LINE_MS,
  CLIMAX_A_MS,
  CLIMAX_B_MS,
  CLIMAX_C_MS,
  CLIMAX_D_MS,
  CLIMAX_E_MS,
  CLIMAX_HOLD_MS,
  DELAY_BEFORE_DETECTION_MS,
  ENV_RESTORE_MS,
  LOCK_COOLDOWN_MS,
  LOCK_FAIL_HOLD_MS,
  LOCK_FAILS_BEFORE_COOLDOWN,
  LOCK_OK_HOLD_MS,
  RECOVERY_LINE_MS,
  REDUCED_MOTION_CUT_MS,
  RESTORE_MS,
  UNLOCK_LINE_AT_MS,
  VOID_HOLD_MS,
  prefersReducedMotion,
  type D14DevSkip,
} from "./config";
import { BOOT_LINES, RECOVERY_LINES, RESTORE_LINES } from "./copy";
import { requestPatternValidation } from "./d14GateClient";

export type D14Phase =
  | "idle"
  | "booting"
  | "recovery"
  | "restoring"
  | "locked"
  | "unlocking"
  | "desktop"
  | "anomaly"
  | "takeover"
  | "void"
  | "terminated";

export type TakeoverBeat = "a" | "hold" | "b" | "c" | "d" | "e";

export type LockStatus = "idle" | "fail" | "ok" | "cooldown";

export interface D14MachineOptions {
  skip?: D14DevSkip | null;
}

const BOOT_OK_COUNT = 3;

export function useD14Machine(options: D14MachineOptions = {}) {
  const phase = ref<D14Phase>("idle");
  const takeoverBeat = ref<TakeoverBeat | null>(null);
  const bootLineCount = ref(0);
  const recoveryLineCount = ref(0);
  const restoreLineCount = ref(0);
  const unlockLineCount = ref(0);
  const lockStatus = ref<LockStatus>("idle");
  const lockoutRemainingMs = ref(0);
  const patternBusy = ref(false);
  let failStreak = 0;
  let lockoutInterval: ReturnType<typeof setInterval> | 0 = 0;

  const timers = new Set<ReturnType<typeof setTimeout>>();

  function later(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function motionMs(ms: number): number {
    return prefersReducedMotion() ? REDUCED_MOTION_CUT_MS : ms;
  }

  function clearLockoutTick(): void {
    if (lockoutInterval) {
      clearInterval(lockoutInterval);
      lockoutInterval = 0;
    }
  }

  function dispose(): void {
    clearLockoutTick();
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function startBoot(): void {
    if (phase.value !== "idle") return;
    phase.value = "booting";
    bootLineCount.value = 1;
    audio.boot_ok();
    revealBootLines();
  }

  function revealBootLines(): void {
    if (bootLineCount.value >= BOOT_LINES.length) {
      later(motionMs(BOOT_HOLD_DEAD_MS), enterRecovery);
      return;
    }
    const nextIndex = bootLineCount.value;
    const delay = nextIndex >= BOOT_OK_COUNT ? BOOT_FAIL_LINE_MS : BOOT_LINE_MS;
    later(motionMs(delay), () => {
      bootLineCount.value += 1;
      const index = bootLineCount.value - 1;
      if (index < BOOT_OK_COUNT) audio.boot_ok();
      if (index === BOOT_OK_COUNT) audio.net_denied();
      revealBootLines();
    });
  }

  function enterRecovery(): void {
    if (phase.value !== "booting") return;
    phase.value = "recovery";
    recoveryLineCount.value = 1;
    revealRecoveryLines();
  }

  function revealRecoveryLines(): void {
    if (recoveryLineCount.value >= RECOVERY_LINES.length) return;
    later(motionMs(RECOVERY_LINE_MS), () => {
      recoveryLineCount.value += 1;
      revealRecoveryLines();
    });
  }

  function startRestore(): void {
    if (phase.value !== "recovery") return;
    phase.value = "restoring";
    restoreLineCount.value = 1;
    audio.restore();
    const secondAt = Math.floor(motionMs(RESTORE_MS) / 2);
    later(secondAt, () => {
      if (phase.value !== "restoring") return;
      restoreLineCount.value = RESTORE_LINES.length;
    });
    later(motionMs(RESTORE_MS), () => {
      if (phase.value !== "restoring") return;
      phase.value = "locked";
      lockStatus.value = "idle";
    });
  }

  function endLockout(): void {
    clearLockoutTick();
    lockoutRemainingMs.value = 0;
    if (phase.value !== "locked") return;
    lockStatus.value = "idle";
  }

  function startLockout(): void {
    failStreak = 0;
    lockStatus.value = "cooldown";
    lockoutRemainingMs.value = LOCK_COOLDOWN_MS;
    clearLockoutTick();
    lockoutInterval = setInterval(() => {
      lockoutRemainingMs.value = Math.max(0, lockoutRemainingMs.value - 1000);
    }, 1000);
    later(LOCK_COOLDOWN_MS, endLockout);
  }

  async function submitPattern(nodes: readonly number[]): Promise<boolean> {
    if (phase.value !== "locked" || lockStatus.value !== "idle" || patternBusy.value) {
      return false;
    }
    patternBusy.value = true;
    let accepted = false;
    try {
      accepted = await requestPatternValidation(nodes);
    } catch {
      // Network/API errors never unlock.
    } finally {
      patternBusy.value = false;
    }
    if (phase.value !== "locked" || lockStatus.value !== "idle") return false;
    if (accepted) {
      failStreak = 0;
      lockStatus.value = "ok";
      audio.lock_ok();
      try {
        localStorage.setItem("d14_compromised", "true");
      } catch {
        // ignore
      }
      later(motionMs(LOCK_OK_HOLD_MS), startUnlocking);
      return true;
    }
    failStreak += 1;
    lockStatus.value = "fail";
    audio.lock_fail();
    later(motionMs(LOCK_FAIL_HOLD_MS), () => {
      if (phase.value !== "locked") return;
      if (failStreak >= LOCK_FAILS_BEFORE_COOLDOWN) {
        startLockout();
        return;
      }
      lockStatus.value = "idle";
    });
    return false;
  }

  function startUnlocking(): void {
    if (phase.value !== "locked") return;
    phase.value = "unlocking";
    unlockLineCount.value = 0;
    UNLOCK_LINE_AT_MS.forEach((at, index) => {
      later(motionMs(at), () => {
        if (phase.value !== "unlocking") return;
        unlockLineCount.value = index + 1;
      });
    });
    later(motionMs(ENV_RESTORE_MS), enterDesktop);
  }

  function enterDesktop(): void {
    if (phase.value !== "unlocking") return;
    phase.value = "desktop";
    audio.desktop_in();
    armDetection();
  }

  function armDetection(): void {
    later(DELAY_BEFORE_DETECTION_MS, startAnomaly);
  }

  function startAnomaly(): void {
    if (phase.value !== "desktop") return;
    phase.value = "anomaly";
    audio.detect();
    later(motionMs(ANOMALY_LINE_MS), startTakeover);
  }

  function startTakeover(): void {
    if (phase.value !== "anomaly") return;
    phase.value = "takeover";
    takeoverBeat.value = "a";
    audio.incident();
    const a = motionMs(CLIMAX_A_MS);
    const hold = motionMs(CLIMAX_HOLD_MS);
    const b = motionMs(CLIMAX_B_MS);
    const c = motionMs(CLIMAX_C_MS);
    const d = motionMs(CLIMAX_D_MS);
    const e = motionMs(CLIMAX_E_MS);
    later(a, () => {
      if (phase.value !== "takeover") return;
      takeoverBeat.value = "hold";
      audio.false_calm();
    });
    later(a + hold, () => {
      if (phase.value !== "takeover") return;
      takeoverBeat.value = "b";
      audio.takeover();
    });
    later(a + hold + b, () => {
      if (phase.value !== "takeover") return;
      takeoverBeat.value = "c";
      audio.escalate();
    });
    later(a + hold + b + c, () => {
      if (phase.value !== "takeover") return;
      takeoverBeat.value = "d";
      audio.revoke();
    });
    later(a + hold + b + c + d, () => {
      if (phase.value !== "takeover") return;
      takeoverBeat.value = "e";
      audio.hard_cut();
    });
    later(a + hold + b + c + d + e, enterVoid);
  }

  function enterVoid(): void {
    if (phase.value !== "takeover") return;
    phase.value = "void";
    takeoverBeat.value = null;
    later(motionMs(VOID_HOLD_MS), () => {
      if (phase.value !== "void") return;
      phase.value = "terminated";
      audio.d07_mark();
    });
  }

  function applySkip(skip: D14DevSkip | null | undefined): void {
    if (!skip) {
      try {
        if (localStorage.getItem("d14_compromised") === "true") {
          phase.value = "terminated";
        }
      } catch (e) {
        // ignore
      }
      return;
    }
    phase.value = "desktop";
    audio.desktop_in();
    if (skip === "climax") {
      startAnomaly();
      return;
    }
    armDetection();
  }

  applySkip(options.skip ?? null);

  if (getCurrentInstance()) {
    onUnmounted(dispose);
  }

  return {
    phase,
    takeoverBeat,
    bootLineCount,
    recoveryLineCount,
    restoreLineCount,
    unlockLineCount,
    lockStatus,
    lockoutRemainingMs,
    patternBusy,
    startBoot,
    startRestore,
    submitPattern,
    dispose,
  };
}
