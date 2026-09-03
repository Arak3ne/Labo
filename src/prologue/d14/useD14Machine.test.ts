import { afterEach, describe, expect, it, vi } from "vitest";
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
  LOCK_OK_HOLD_MS,
  RESTORE_MS,
  UNLOCK_LINE_AT_MS,
  VOID_HOLD_MS,
} from "./config";
import { useD14Machine } from "./useD14Machine";

describe("D-14 machine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks idle → boot → recovery → restore → lock success → desktop", () => {
    vi.useFakeTimers();
    const machine = useD14Machine();

    expect(machine.phase.value).toBe("idle");

    machine.startBoot();
    expect(machine.phase.value).toBe("booting");
    expect(machine.bootLineCount.value).toBe(1);

    vi.advanceTimersByTime(
      BOOT_LINE_MS * 2 + BOOT_FAIL_LINE_MS * 3 + BOOT_HOLD_DEAD_MS,
    );
    expect(machine.phase.value).toBe("recovery");

    machine.startRestore();
    expect(machine.phase.value).toBe("restoring");
    vi.advanceTimersByTime(RESTORE_MS);
    expect(machine.phase.value).toBe("locked");
    expect(machine.lockStatus.value).toBe("idle");

    const accepted = machine.submitPattern([1, 6, 5, 0, 7, 2, 4]);
    expect(accepted).toBe(true);
    expect(machine.lockStatus.value).toBe("ok");

    vi.advanceTimersByTime(LOCK_OK_HOLD_MS);
    expect(machine.phase.value).toBe("unlocking");
    expect(machine.unlockLineCount.value).toBe(0);

    vi.advanceTimersByTime(UNLOCK_LINE_AT_MS[0]);
    expect(machine.unlockLineCount.value).toBe(1);
    vi.advanceTimersByTime(UNLOCK_LINE_AT_MS[1] - UNLOCK_LINE_AT_MS[0]);
    expect(machine.unlockLineCount.value).toBe(2);
    vi.advanceTimersByTime(UNLOCK_LINE_AT_MS[2] - UNLOCK_LINE_AT_MS[1]);
    expect(machine.unlockLineCount.value).toBe(3);

    vi.advanceTimersByTime(ENV_RESTORE_MS - UNLOCK_LINE_AT_MS[2]);
    expect(machine.phase.value).toBe("desktop");

    machine.dispose();
  });

  it("rejects an unknown pattern and returns to idle lock", () => {
    vi.useFakeTimers();
    const machine = useD14Machine();
    machine.startBoot();
    vi.advanceTimersByTime(
      BOOT_LINE_MS * 2 + BOOT_FAIL_LINE_MS * 3 + BOOT_HOLD_DEAD_MS,
    );
    machine.startRestore();
    vi.advanceTimersByTime(RESTORE_MS);

    const rejected = machine.submitPattern([0, 3, 6, 7, 8]);
    expect(rejected).toBe(false);
    expect(machine.lockStatus.value).toBe("fail");
    expect(machine.phase.value).toBe("locked");

    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    expect(machine.lockStatus.value).toBe("idle");

    machine.dispose();
  });

  it("suspends the lock for one minute after three failed patterns", () => {
    vi.useFakeTimers();
    const machine = useD14Machine();
    machine.startBoot();
    vi.advanceTimersByTime(
      BOOT_LINE_MS * 2 + BOOT_FAIL_LINE_MS * 3 + BOOT_HOLD_DEAD_MS,
    );
    machine.startRestore();
    vi.advanceTimersByTime(RESTORE_MS);

    machine.submitPattern([0, 1, 2]);
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    machine.submitPattern([0, 1, 2]);
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    machine.submitPattern([0, 1, 2]);
    expect(machine.lockStatus.value).toBe("fail");
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    expect(machine.lockStatus.value).toBe("cooldown");
    expect(machine.lockoutRemainingMs.value).toBe(LOCK_COOLDOWN_MS);
    expect(machine.submitPattern([1, 6, 5, 0, 7, 2, 4])).toBe(false);

    vi.advanceTimersByTime(LOCK_COOLDOWN_MS);
    expect(machine.lockStatus.value).toBe("idle");
    expect(machine.lockoutRemainingMs.value).toBe(0);

    machine.submitPattern([0, 1, 2]);
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    machine.submitPattern([0, 1, 2]);
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    machine.submitPattern([0, 1, 2]);
    vi.advanceTimersByTime(LOCK_FAIL_HOLD_MS);
    expect(machine.lockStatus.value).toBe("cooldown");

    machine.dispose();
  });

  it("starts detection almost immediately after the desktop appears", () => {
    vi.useFakeTimers();
    const machine = useD14Machine({ skip: "desktop" });
    expect(machine.phase.value).toBe("desktop");
    vi.advanceTimersByTime(DELAY_BEFORE_DETECTION_MS);
    expect(machine.phase.value).toBe("anomaly");
    machine.dispose();
  });

  it("skips to anomaly when climax is requested", () => {
    vi.useFakeTimers();
    const machine = useD14Machine({ skip: "climax" });
    expect(machine.phase.value).toBe("anomaly");
    machine.dispose();
  });

  it("plays climax A–E through void to the D-07 clean terminal", () => {
    vi.useFakeTimers();
    const machine = useD14Machine({ skip: "climax" });

    vi.advanceTimersByTime(ANOMALY_LINE_MS);
    expect(machine.phase.value).toBe("takeover");
    expect(machine.takeoverBeat.value).toBe("a");

    vi.advanceTimersByTime(CLIMAX_A_MS);
    expect(machine.takeoverBeat.value).toBe("hold");

    vi.advanceTimersByTime(CLIMAX_HOLD_MS);
    expect(machine.takeoverBeat.value).toBe("b");

    vi.advanceTimersByTime(CLIMAX_B_MS + CLIMAX_C_MS + CLIMAX_D_MS);
    expect(machine.takeoverBeat.value).toBe("e");

    vi.advanceTimersByTime(CLIMAX_E_MS);
    expect(machine.phase.value).toBe("void");

    vi.advanceTimersByTime(VOID_HOLD_MS);
    expect(machine.phase.value).toBe("terminated");

    machine.dispose();
  });
});
