<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import PatternLock from "./PatternLock.vue";
import * as audio from "./audioHooks";
import { playClimaxD, type ClimaxDHandle, type DeathLayer } from "./climaxD";
import {
  CTA_ARM_MS,
  FILE_NOTICE_MS,
  REDUCED_MOTION_CUT_MS,
  prefersReducedMotion,
  readD14DevSkip,
} from "./config";
import {
  ARRIVAL_DUMP,
  BOOT_LINES,
  BRAND,
  BRAND_D07,
  CHIP_LOCKED,
  CHIP_NET_DOWN,
  CHIP_POWER,
  CHIP_RESTORING,
  CHIP_SESSION_LOCAL,
  CHIP_TERMINAL_REVOKED,
  CLOCK_DEAD,
  CTA_INIT,
  CTA_RESTORE,
  ENV_RESTORE_TITLE,
  F_BODY,
  F_LOG,
  F_SUBTITLE,
  F_TITLE,
  FILE_NOTICE,
  FOLDER_EMPTY,
  FOLDER_REVOKED,
  FOLDER_UNAVAILABLE,
  FOOT_DENIED,
  FOOT_DESKTOP,
  FOOT_LAST_STOP,
  FOOT_LOCAL_OK,
  FOOT_LOCK,
  FOOT_LOCK_WAIT,
  FOOT_NET_UP,
  FOOT_READONLY,
  FOOT_RECOVERY,
  FOOT_VERIFY,
  FRAGMENT_CLEARING,
  FRAGMENT_LINE,
  IDENTITY_SESSION,
  LOCK_COOLDOWN,
  LOCK_FAIL,
  LOCK_OK,
  LOCK_REQUIRED,
  PANEL_EMPTY,
  RECOVERY_LINES,
  RESTORE_LINES,
  STRIP_ID,
  STRIP_REVOKE,
  STRIP_SYNC,
  REVOKE_STAMPS,
  REVOKE_TICKS,
  TERMINAL,
  TERMINAL_D07,
  UNLOCK_LINES,
  VOID_LINES,
  COM_TITLE,
  COM_SUBTITLE,
  COM_LINES,
  COM_STATUS,
  RES_TITLE,
  RES_HOTE_PLACEHOLDER,
  RES_HOTE_SUFFIX,
  RES_HOTE_ERROR,
} from "./copy";
import { requestHostValidation } from "./d14GateClient";
import { DEFAULT_FOLDER_ID, DESKTOP_FOLDERS, REVOKE_FOLDER_IDS, folderById } from "./desktop";
import { useD14Machine } from "./useD14Machine";
import "./d14.css";
import "./d14-com.css";

const skip = readD14DevSkip();
const rootRef = ref<HTMLElement | null>(null);
const {
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
} = useD14Machine({ skip });

const ctaArmed = ref(false);
const ctaBusy = ref(false);
const selectedFolderId = ref<string | null>(null);
const fileNotice = ref(false);
const stripOpen = ref(false);
const stripOverlay = ref(false);
const stripText = ref("");
const headerPartial = ref(false);
const footNetUp = ref(false);
const footReadonly = ref(false);
const identityGlitch = ref(false);
const folderGlitch = ref(false);
const inputHost = ref("");
const inputDirty = ref(false);
const hostAccepted = ref(false);
const hostBusy = ref(false);
const fragmentVisible = ref(false);
const fragmentTruncated = ref(false);
const voidElias = ref(false);
const voidEliasOut = ref(false);
const eliasOnVoid = ref(false);
const brandAligned = ref(false);
const cursorLock = ref<"none" | "wait" | "denied">("none");
const unavailable = ref<string[]>([]);
const revoked = ref<string[]>([]);
const stamps = ref<string[]>([]);
const cutFlash = ref(false);
const clockText = ref(CLOCK_DEAD);
const deathFx = ref<Record<DeathLayer, boolean>>({
  scan: false,
  alarm: false,
  kill: false,
  tear: false,
  rgb: false,
  shake: false,
  crt: false,
  black: false,
});

let ctaTimer = 0;
let noticeTimer = 0;
let clockTimer = 0;
const localTimers = new Set<number>();
let climaxD: ClimaxDHandle | null = null;

function clearDeath(): void {
  window.clearInterval(clockTimer);
  clockTimer = 0;
  clockText.value = CLOCK_DEAD;
  deathFx.value = {
    scan: false,
    alarm: false,
    kill: false,
    tear: false,
    rgb: false,
    shake: false,
    crt: false,
    black: false,
  };
}

function setLayer(name: DeathLayer, on: boolean): void {
  if (deathFx.value[name] === on) return;
  deathFx.value = { ...deathFx.value, [name]: on };
}

function startClockFlicker(): void {
  window.clearInterval(clockTimer);
  clockTimer = 0;
  clockText.value = CLOCK_DEAD;
}

function motionDelay(ms: number): number {
  return prefersReducedMotion() ? Math.min(ms, REDUCED_MOTION_CUT_MS) : ms;
}

function later(ms: number, fn: () => void): void {
  const id = window.setTimeout(() => {
    localTimers.delete(id);
    fn();
  }, motionDelay(ms));
  localTimers.add(id);
}

function clearLocal(): void {
  window.clearTimeout(ctaTimer);
  window.clearTimeout(noticeTimer);
  for (const id of localTimers) window.clearTimeout(id);
  localTimers.clear();
  climaxD?.kill();
  climaxD = null;
  clearDeath();
  audio.shutdown();
}

const beat = computed(() => takeoverBeat.value);
const showTerminated = computed(() => phase.value === "terminated");
const showVoid = computed(() => phase.value === "void");
const showVoidText = computed(() => phase.value === "takeover" && beat.value === "e");
const showWork = computed(
  () => !showTerminated.value && !showVoid.value && !showVoidText.value,
);
const desktopish = computed(
  () =>
    phase.value === "desktop" ||
    phase.value === "anomaly" ||
    (phase.value === "takeover" && beat.value !== "e"),
);
const lockedInteraction = computed(() => desktopish.value || cursorLock.value !== "none");
const selectedFolder = computed(() =>
  selectedFolderId.value ? folderById(selectedFolderId.value) : undefined,
);
const lockLabel = computed(() => {
  if (lockStatus.value === "fail") return LOCK_FAIL;
  if (lockStatus.value === "ok") return LOCK_OK;
  if (lockStatus.value === "cooldown") {
    const total = Math.max(0, Math.ceil(lockoutRemainingMs.value / 1000));
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${LOCK_COOLDOWN}  ${minutes}:${seconds}`;
  }
  return LOCK_REQUIRED;
});
const anomalyDraw = computed(
  () => phase.value === "anomaly" || phase.value === "takeover",
);

const headerChips = computed(() => {
  if (desktopish.value) {
    return [
      {
        id: "session",
        text: IDENTITY_SESSION,
        kind: "session",
      },
    ];
  }
  if (phase.value === "unlocking") {
    return [{ id: "restoring", text: CHIP_RESTORING, kind: "plain" }];
  }
  if (phase.value === "locked") {
    return [
      {
        id: "schema",
        text: lockStatus.value === "cooldown" ? LOCK_COOLDOWN : LOCK_REQUIRED,
        kind: "plain",
      },
    ];
  }
  if (phase.value === "restoring") {
    return [
      { id: "local", text: CHIP_SESSION_LOCAL, kind: "plain" },
      { id: "locked", text: CHIP_LOCKED, kind: "plain" },
    ];
  }
  if (phase.value === "recovery") {
    return [{ id: "local", text: CHIP_SESSION_LOCAL, kind: "plain" }];
  }
  if (phase.value === "booting" && bootLineCount.value >= 4) {
    return [
      { id: "net", text: CHIP_NET_DOWN, kind: "plain" },
      { id: "power", text: CHIP_POWER, kind: "plain" },
    ];
  }
  return [
    { id: "net", text: CHIP_TERMINAL_REVOKED, kind: "plain" },
    { id: "power", text: CHIP_POWER, kind: "plain" },
  ];
});

const footItems = computed(() => {
  if (footReadonly.value) return [FOOT_READONLY];
  if (footNetUp.value) return [FOOT_NET_UP];
  if (phase.value === "idle") return [FOOT_LAST_STOP];
  if (phase.value === "booting") {
    return bootLineCount.value >= 5 ? [FOOT_DENIED] : [FOOT_VERIFY];
  }
  if (phase.value === "recovery") return [FOOT_DENIED];
  if (phase.value === "restoring") return [FOOT_RECOVERY];
  if (phase.value === "locked") {
    return lockStatus.value === "cooldown" ? [FOOT_LOCK_WAIT] : [FOOT_LOCK];
  }
  if (phase.value === "unlocking") return [FOOT_LOCAL_OK];
  return [...FOOT_DESKTOP];
});

const rootClass = computed(() => ({
  "d14--cursor-wait": cursorLock.value === "wait",
  "d14--cursor-denied": cursorLock.value === "denied",
  "d14--readonly": footReadonly.value,
  "d14--void": showVoid.value || showVoidText.value,
  "d14--d07-clean": showTerminated.value,
  "d14--anomaly": phase.value === "anomaly",
  "d14--beat-a": beat.value === "a",
  "d14--beat-hold": beat.value === "hold",
  "d14--beat-b": beat.value === "b",
  "d14--beat-c": beat.value === "c",
  "d14--beat-d": beat.value === "d",
  "d14--beat-e": beat.value === "e",
  "d14--cut": cutFlash.value,
  "d14--imminent": beat.value === "d" || beat.value === "c",
  "d14--fx-scan": deathFx.value.scan,
  "d14--fx-alarm": deathFx.value.alarm,
  "d14--fx-kill": deathFx.value.kill,
  "d14--fx-tear": deathFx.value.tear,
  "d14--fx-rgb": deathFx.value.rgb,
  "d14--fx-shake": deathFx.value.shake,
  "d14--fx-crt": deathFx.value.crt,
  "d14--fx-black": deathFx.value.black,
}));

function folderState(id: string): "idle" | "unavailable" | "revoked" {
  if (revoked.value.includes(id)) return "revoked";
  if (unavailable.value.includes(id)) return "unavailable";
  return "idle";
}

function armCta(action: () => void): void {
  if (ctaBusy.value) return;
  ctaBusy.value = true;
  ctaArmed.value = true;
  window.clearTimeout(ctaTimer);
  ctaTimer = window.setTimeout(() => {
    ctaArmed.value = false;
    ctaBusy.value = false;
    action();
  }, CTA_ARM_MS);
}

function openFolder(id: string): void {
  if (lockedInteraction.value) return;
  if (folderState(id) !== "idle") return;
  selectedFolderId.value = id;
  fileNotice.value = false;
}

function closeFolder(): void {
  if (lockedInteraction.value) return;
  selectedFolderId.value = null;
  fileNotice.value = false;
}

function cleanHostInput(): void {
  inputHost.value = inputHost.value.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  hostAccepted.value = false;
  inputDirty.value = false;
}

async function resolveHost(): Promise<void> {
  if (lockedInteraction.value || hostBusy.value) return;
  inputDirty.value = true;
  hostAccepted.value = false;
  hostBusy.value = true;
  let accepted = false;
  try {
    accepted = await requestHostValidation(inputHost.value);
  } catch {
    // Network/API errors never open the resource.
  } finally {
    hostBusy.value = false;
  }
  if (!accepted) return;
  hostAccepted.value = true;
  window.open(
    `https://${inputHost.value}${RES_HOTE_SUFFIX}/wiki/`,
    "_blank",
    "noopener,noreferrer",
  );
}

function onFileClick(): void {
  if (lockedInteraction.value) return;
  fileNotice.value = true;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    fileNotice.value = false;
  }, FILE_NOTICE_MS);
}

function runA(): void {
  cursorLock.value = "wait";
  later(140, () => {
    identityGlitch.value = true;
  });
  later(420, () => {
    identityGlitch.value = false;
  });
  later(260, () => {
    folderGlitch.value = true;
  });
  later(520, () => {
    folderGlitch.value = false;
  });
  later(640, () => {
    const scar =
      DESKTOP_FOLDERS.find((folder) => folder.id !== selectedFolderId.value)?.id ??
      "archives";
    if (!unavailable.value.includes(scar)) {
      unavailable.value = [...unavailable.value, scar];
    }
  });
  later(1100, () => {
    cursorLock.value = "none";
  });
}

function runHold(): void {
  identityGlitch.value = false;
  folderGlitch.value = false;
  cursorLock.value = "none";
  setLayer("alarm", false);
  setLayer("kill", false);
  setLayer("scan", false);
  setLayer("tear", false);
  setLayer("rgb", false);
  setLayer("shake", false);
}

function runB(): void {
  setLayer("alarm", true);
  headerPartial.value = true;
  stripOverlay.value = true;
  footNetUp.value = true;
  later(80, () => {
    stripOpen.value = true;
    stripText.value = STRIP_SYNC;
  });
  later(420, () => {
    stripText.value = STRIP_ID;
  });
  later(120, () => {
    cursorLock.value = "wait";
  });
  later(280, () => {
    DESKTOP_FOLDERS.forEach((folder, index) => {
      later(index * 70, () => {
        if (!unavailable.value.includes(folder.id)) {
          unavailable.value = [...unavailable.value, folder.id];
        }
      });
    });
  });
  later(1600, () => {
    footReadonly.value = true;
    cursorLock.value = "denied";
  });
  later(2100, () => {
    brandAligned.value = true;
  });
}

function runC(): void {
  setLayer("kill", true);
  setLayer("scan", true);
  startClockFlicker();
  later(80, () => {
    stripText.value = STRIP_REVOKE;
  });
  later(280, () => {
    stripText.value = STRIP_ID;
  });
  later(480, () => {
    stripText.value = STRIP_REVOKE;
  });
  for (let i = 0; i < 8; i += 1) {
    later(i * 160, () => {
      identityGlitch.value = true;
    });
    later(i * 160 + 70, () => {
      identityGlitch.value = false;
    });
  }
  later(200, () => {
    folderGlitch.value = true;
  });
  later(420, () => {
    folderGlitch.value = false;
  });
  later(640, () => {
    folderGlitch.value = true;
  });
  later(820, () => {
    folderGlitch.value = false;
  });
  later(500, () => {
    revoked.value = [...REVOKE_FOLDER_IDS];
  });
  later(720, () => {
    fragmentVisible.value = true;
    fragmentTruncated.value = false;
  });
  later(1800, () => {
    fragmentTruncated.value = true;
  });
}

function runD(): void {
  climaxD?.kill();
  climaxD = null;
  eliasOnVoid.value = false;
  stamps.value = [];
  cutFlash.value = false;
  cursorLock.value = "denied";
  if (prefersReducedMotion()) return;
  void nextTick(() => {
    const root = rootRef.value;
    if (!root || takeoverBeat.value !== "d") return;
    climaxD = playClimaxD(root, {
      onElias(visible) {
        eliasOnVoid.value = visible;
      },
      onStamp(index) {
        const next = REVOKE_STAMPS[index];
        if (!next) return;
        stamps.value = [...stamps.value, next];
      },
      onCut(on) {
        cutFlash.value = on;
      },
      onLayer(name, on) {
        setLayer(name, on);
      },
    });
  });
}

function runE(): void {
  climaxD?.kill();
  climaxD = null;
  clearDeath();
  window.clearInterval(clockTimer);
  clockTimer = 0;
  eliasOnVoid.value = false;
  voidEliasOut.value = false;
  voidElias.value = true;
  later(80, () => {
    voidEliasOut.value = true;
  });
  later(900, () => {
    voidElias.value = false;
  });
}

watch(phase, (next) => {
  if (next === "desktop") {
    // Ne plus ouvrir de dossier par défaut, on laisse le panneau sur "Dernière communication"
    inputHost.value = "";
    inputDirty.value = false;
    hostAccepted.value = false;
  }
});

watch(beat, (next, prev) => {
  if (prev === "d") {
    climaxD?.kill();
    climaxD = null;
  }
  if (next === "a") runA();
  if (next === "hold") runHold();
  if (next === "b") runB();
  if (next === "c") runC();
  if (next === "d") runD();
  if (next === "e") runE();
});

onMounted(() => {
  if (phase.value === "idle") audio.idle_hum();
  if (phase.value === "desktop") audio.desktop_in();
  if (phase.value === "anomaly") audio.detect();
});

onUnmounted(clearLocal);
</script>

<template>
  <main
    ref="rootRef"
    class="d14"
    :class="rootClass"
    lang="fr"
    @pointerdown="audio.prime"
  >
    <div
      class="d14-death"
      aria-hidden="true"
    >
      <div class="d14-death__vignette" />
      <div class="d14-death__scan" />
      <div class="d14-death__tear" />
      <div class="d14-death__blow" />
      <div class="d14-death__crt">
        <span class="d14-death__line" />
        <span class="d14-death__dot" />
      </div>
    </div>
    <p
      v-if="eliasOnVoid"
      class="d14-elias-vestige"
    >
      {{ IDENTITY_SESSION }}
    </p>
    <div
      v-if="showTerminated"
      class="d14__frame"
    >
      <header class="d14-d07-header">
        <p
          class="d14-d07-brand"
          v-text="BRAND_D07"
        />
        <span class="d14-d07-spacer" />
        <p
          class="d14-d07-terminal"
          v-text="TERMINAL_D07"
        />
      </header>
      <div class="d14-d07-stage">
        <div class="d14-d07-copy">
          <h1 class="d14-d07-title">
            {{ F_TITLE }}
          </h1>
          <p class="d14-d07-subtitle">
            {{ F_SUBTITLE }}
          </p>
          <div class="d14-d07-prose">
            <p
              v-for="(line, index) in F_BODY"
              :key="index"
            >
              {{ line }}
            </p>
          </div>
        </div>
        <footer class="d14-d07-foot">
          <div class="d14-d07-log">
            <p
              v-for="line in F_LOG"
              :key="line"
            >
              {{ line }}
            </p>
          </div>
        </footer>
      </div>
    </div>

    <div
      v-else-if="showVoid"
      class="d14__frame"
      aria-hidden="true"
    />

    <div
      v-else-if="showVoidText"
      class="d14__frame"
    >
      <div class="d14-void-copy">
        <p
          v-for="line in VOID_LINES"
          :key="line"
        >
          {{ line }}
        </p>
        <p
          v-if="voidElias"
          class="d14-void-elias"
          :class="{ 'd14-void-elias--out': voidEliasOut }"
        >
          {{ IDENTITY_SESSION }}
        </p>
      </div>
    </div>

    <div
      v-else-if="showWork"
      class="d14__frame"
    >
      <header
        class="d14-header"
        :class="{
          'd14-header--partial-d07': headerPartial,
          'd14-header--d07-aligned': brandAligned,
        }"
      >
        <div class="d14-header__row d14-header__row--1">
          <p
            class="d14__brand"
            v-text="BRAND"
          />
          <p class="d14__terminal">
            <span class="d14__terminal-full">{{ TERMINAL }}</span>
            <span class="d14__terminal-short">D-14</span>
          </p>
          <p
            class="d14__clock"
            v-text="clockText"
          />
          <p
            v-if="headerPartial"
            class="d14__brand-d07"
            aria-hidden="true"
            v-text="BRAND_D07"
          />
        </div>
        <div class="d14-header__row d14-header__row--2">
          <p
            v-for="chip in headerChips"
            :key="chip.id"
            class="d14-chip"
            :class="{
              'd14-chip--session': chip.kind === 'session',
              'd14-chip--glitch': chip.kind === 'session' && identityGlitch,
              'd14-glitch-target': chip.kind === 'session',
            }"
          >
            {{ chip.text }}
          </p>
        </div>
        <span
          class="d14-filet d14-filet--header"
          aria-hidden="true"
        />
      </header>

      <div
        class="d14-anomaly"
        :class="{ 'd14-anomaly--draw': anomalyDraw }"
      />

      <div
        class="d14-strip d14-strip--d07"
        :class="{
          'd14-strip--open': stripOpen,
          'd14-strip--overlay': stripOverlay,
        }"
      >
        {{ stripText }}
        <span
          class="d14-filet d14-filet--strip"
          aria-hidden="true"
        />
      </div>

      <div
        v-if="stamps.length"
        class="d14-stamps"
        aria-hidden="true"
      >
        <p
          v-for="(line, stampIndex) in stamps"
          :key="stampIndex"
          class="d14-stamps__line"
        >
          {{ line }}
        </p>
      </div>

      <div
        v-if="beat === 'd'"
        class="d14-revoke-meter"
        aria-hidden="true"
      >
        <span
          v-for="n in REVOKE_TICKS"
          :key="n"
          class="d14-revoke-meter__tick"
        />
      </div>

      <div
        class="d14__stage"
        :class="{ 'd14__stage--folder-open': Boolean(selectedFolderId) && desktopish }"
      >
        <div
          v-if="phase === 'idle'"
          class="d14__pane"
        >
          <div class="d14-dump">
            <p
              v-for="line in ARRIVAL_DUMP"
              :key="line.label"
              class="d14-dump__row"
            >
              <span class="d14-dump__k">{{ line.label }}</span>
              <span class="d14-dump__v">{{ line.value }}</span>
            </p>
          </div>
          <button
            class="d14-cta"
            :class="{ 'd14-cta--armed': ctaArmed }"
            type="button"
            :disabled="ctaBusy"
            @click="armCta(startBoot)"
          >
            <span class="d14-cta__prefix">&gt;</span>
            <span>{{ CTA_INIT }}</span>
          </button>
        </div>

        <div
          v-else-if="phase === 'booting' || phase === 'recovery'"
          class="d14__pane"
        >
          <div class="d14-dump d14-dump--log">
            <p
              v-for="(line, index) in BOOT_LINES.slice(0, bootLineCount)"
              :key="`boot-${index}`"
              class="d14-dump__row"
            >
              <span class="d14-dump__k">{{ line.label }}</span>
              <span class="d14-dump__v">{{ line.value }}</span>
            </p>
            <p
              v-for="(line, index) in RECOVERY_LINES.slice(0, recoveryLineCount)"
              :key="`rec-${index}`"
              class="d14-dump__row"
            >
              <span class="d14-dump__k">{{ line.label }}</span>
              <span class="d14-dump__v">{{ line.value }}</span>
            </p>
          </div>
          <template v-if="phase === 'recovery' && recoveryLineCount >= RECOVERY_LINES.length">
            <div class="d14-com">
              <p class="d14-panel__title">{{ COM_TITLE }}</p>
              <p class="d14-com__sub">{{ COM_SUBTITLE }}</p>
              <div class="d14-com__payload d14-glitch-target">
                <p v-for="(line, index) in COM_LINES" :key="index">
                  {{ line || '&nbsp;' }}
                </p>
              </div>
              <p class="d14-com__status">{{ COM_STATUS }}</p>
            </div>

            <div class="d14-res">
              <p class="d14-panel__title">{{ RES_TITLE }}</p>
              <div class="d14-dump">
                <p class="d14-dump__row">
                  <span class="d14-dump__k">PROTOCOLE</span>
                  <span class="d14-dump__v">HTTPS</span>
                </p>
                <label class="d14-dump__row d14-dump__row--input">
                  <span class="d14-dump__k">HÔTE</span>
                  <div
                    class="d14-res__input-group"
                    :class="{ 'd14-res__input-group--error': inputDirty && !hostAccepted }"
                  >
                    <input
                      v-model="inputHost"
                      type="text"
                      class="d14-res__input"
                      :class="{ 'd14-res__input--error': inputDirty && !hostAccepted }"
                      :placeholder="RES_HOTE_PLACEHOLDER"
                      spellcheck="false"
                      autocomplete="off"
                      @input="cleanHostInput"
                      @keydown.enter="resolveHost"
                    />
                    <span class="d14-res__suffix">{{ RES_HOTE_SUFFIX }}</span>
                  </div>
                </label>
                <p class="d14-dump__row" v-if="inputDirty && !hostAccepted">
                  <span class="d14-dump__k"></span>
                  <span class="d14-dump__v d14-dump__v--error">{{ RES_HOTE_ERROR }}</span>
                </p>
                <p class="d14-dump__row">
                  <span class="d14-dump__k">CHEMIN</span>
                  <span class="d14-dump__v">/wiki/</span>
                </p>
              </div>
              <div class="d14-res__actions">
                <button
                  class="d14-cta"
                  :class="{ 'd14-cta--armed': ctaArmed }"
                  type="button"
                  :disabled="ctaBusy"
                  @click="armCta(startRestore)"
                >
                  <span class="d14-cta__prefix">&gt;</span>
                  <span>{{ CTA_RESTORE }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>

        <div
          v-else-if="phase === 'restoring'"
          class="d14__pane"
        >
          <div class="d14-dump d14-dump--log">
            <p
              v-for="(line, index) in RESTORE_LINES.slice(0, restoreLineCount)"
              :key="`rst-${index}`"
              class="d14-dump__row"
            >
              <span class="d14-dump__k">{{ line.label }}</span>
              <span class="d14-dump__v">{{ line.value }}</span>
            </p>
          </div>
        </div>

        <div
          v-else-if="phase === 'locked'"
          class="d14-lock-wrap"
          :class="{ 'd14-lock-wrap--cooldown': lockStatus === 'cooldown' }"
        >
          <p
            id="d14-lock-label"
            class="d14-lock-status"
          >
            {{ LOCK_REQUIRED }}
          </p>
          <PatternLock
            :aria-describedby="
              lockStatus === 'idle'
                ? 'd14-lock-label'
                : 'd14-lock-label d14-lock-feedback'
            "
            :disabled="lockStatus !== 'idle' || patternBusy"
            :status="lockStatus === 'ok' || lockStatus === 'fail' ? lockStatus : 'idle'"
            @submit="submitPattern"
          />
          <p
            v-if="lockStatus !== 'idle'"
            id="d14-lock-feedback"
            class="d14-lock-status"
            :class="{
              'd14-lock-status--fail': lockStatus === 'fail' || lockStatus === 'cooldown',
              'd14-lock-status--ok': lockStatus === 'ok',
            }"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ lockLabel }}
          </p>
        </div>

        <div
          v-else-if="phase === 'unlocking'"
          class="d14__pane"
        >
          <p class="d14-env-title">
            {{ ENV_RESTORE_TITLE }}
          </p>
          <div class="d14-dump d14-dump--log d14-dump--flush">
            <p
              v-for="(line, index) in UNLOCK_LINES.slice(0, unlockLineCount)"
              :key="`unl-${index}`"
              class="d14-dump__row"
            >
              <span class="d14-dump__k">{{ line.label }}</span>
              <span class="d14-dump__v">{{ line.value }}</span>
            </p>
          </div>
        </div>

        <div
          v-else-if="desktopish"
          class="d14-desktop"
        >
          <nav
            class="d14-index"
            aria-label="Index local"
          >
            <button
              v-for="folder in DESKTOP_FOLDERS"
              :key="folder.id"
              class="d14-folder"
              :class="{
                'd14-folder--selected': selectedFolderId === folder.id,
                'd14-folder--unavailable': folderState(folder.id) === 'unavailable',
                'd14-folder--revoked': folderState(folder.id) === 'revoked',
                'd14-folder--glitch': folderGlitch && folder.id === (selectedFolderId ?? DEFAULT_FOLDER_ID),
                'd14-glitch-target': folder.id === DEFAULT_FOLDER_ID,
              }"
              type="button"
              :disabled="lockedInteraction || folderState(folder.id) !== 'idle'"
              @click="openFolder(folder.id)"
            >
              <span
                class="d14-folder__rail"
                aria-hidden="true"
              />
              <span class="d14-folder__name">{{ folder.name }}</span>
              <span
                v-if="folderState(folder.id) === 'unavailable'"
                class="d14-folder__state"
              >{{ FOLDER_UNAVAILABLE }}</span>
              <span
                v-else-if="folderState(folder.id) === 'revoked'"
                class="d14-folder__state"
              >{{ FOLDER_REVOKED }}</span>
            </button>
          </nav>

          <section
            class="d14-panel"
            aria-live="polite"
          >
            <button
              class="d14-panel__back"
              type="button"
              :disabled="lockedInteraction"
              @click="closeFolder"
            >
              {{ selectedFolder ? `RETOUR  /  ${selectedFolder.name}` : "RETOUR" }}
            </button>
            <template v-if="selectedFolder">
              <div
                v-if="fragmentVisible"
                class="d14-fragment d14-glitch-target"
              >
                <p>{{ FRAGMENT_LINE }}</p>
                <p v-if="!fragmentTruncated">
                  {{ FRAGMENT_CLEARING }}
                </p>
              </div>
              <p class="d14-panel__title">
                {{ selectedFolder.name }}
              </p>
              <p
                v-if="selectedFolder.files.length === 0"
                class="d14-panel__empty"
              >
                {{ FOLDER_EMPTY }}
              </p>
              <div
                v-else
                class="d14-files"
              >
                <button
                  v-for="file in selectedFolder.files"
                  :key="file.id"
                  class="d14-file"
                  type="button"
                  :disabled="lockedInteraction"
                  @click="onFileClick"
                >
                  {{ file.name }}
                </button>
              </div>
              <p
                v-if="fileNotice"
                class="d14-file-notice"
              >
                {{ FILE_NOTICE }}
              </p>
            </template>
            <p
              v-else
              class="d14-panel__empty"
            >
              {{ PANEL_EMPTY }}
            </p>
          </section>
        </div>
      </div>

      <footer
        class="d14__foot"
        :class="{
          'd14__foot--readonly': footReadonly,
          'd14__foot--net': footNetUp && !footReadonly,
        }"
      >
        <p
          v-for="item in footItems"
          :key="item"
          class="d14__foot-item"
        >
          {{ item }}
        </p>
        <span
          class="d14-filet d14-filet--foot"
          aria-hidden="true"
        />
      </footer>
    </div>
  </main>
</template>
