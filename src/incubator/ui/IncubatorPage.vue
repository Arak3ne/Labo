<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getMorueVoice } from "../audio";
import PlaygroundScene from "../scene/PlaygroundScene.vue";
import type { IncubatorSceneInteraction, IncubatorScreenAnchors } from "../scene/sceneEvents";
import type { IncubatorSceneApi } from "../types";
import IncubatorPlaygroundControls from "./IncubatorPlaygroundControls.vue";
import IncubatorProductConsole from "./IncubatorProductConsole.vue";
import "./incubator-console.css";
import { useIncubatorAuth } from "./incubatorAuth";
import { resolveIncubatorFingerprintClient } from "./incubatorFingerprintClient";
import { useIncubatorConsole } from "./useIncubatorConsole";

const auth = useIncubatorAuth();
const voice = getMorueVoice();
const fingerprintClient = await resolveIncubatorFingerprintClient(auth.projection.value.player.id);
const scene = ref<{ api: IncubatorSceneApi | null } | null>(null);
const isDev = import.meta.env.DEV;
const hoveredChamber = ref<"left" | "right" | null>(null);
const devOpen = ref(false);
let suppressBackdropClose = false;
const anchors = ref<IncubatorScreenAnchors>({
  left: { x: innerWidth * 0.28, y: innerHeight * 0.5, visible: true },
  right: { x: innerWidth * 0.72, y: innerHeight * 0.5, visible: true },
  core: { x: innerWidth * 0.5, y: innerHeight * 0.5, visible: true },
  terminal: { x: innerWidth * 0.82, y: innerHeight * 0.78, visible: true },
  threshold: { x: innerWidth * 0.5, y: innerHeight * 0.62, visible: true },
});

const consoleState = useIncubatorConsole(scene, {
  projection: auth.projection.value,
  fingerprintClient,
  voice,
});
const api = computed(() => scene.value?.api ?? null);

function onSceneInteraction(event: IncubatorSceneInteraction) {
  if (event.target === "threshold") {
    if (event.kind === "click") consoleState.skipIntro();
    return;
  }
  if (event.target === "terminal") {
    if (event.kind === "click") consoleState.openAccessTerminal();
    return;
  }
  if (
    consoleState.introActive.value ||
    consoleState.phase.value === "inside" ||
    consoleState.phase.value === "access_terminal" ||
    consoleState.phase.value === "access_granted"
  ) return;
  if (event.kind === "hover") {
    hoveredChamber.value = event.active ? event.target : null;
    return;
  }
  suppressBackdropClose = true;
  queueMicrotask(() => {
    suppressBackdropClose = false;
  });
  consoleState.openChamber(event.target);
}

function onCloseRequest() {
  if (suppressBackdropClose) return;
  consoleState.closeContext();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") consoleState.handleEscape();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main
    class="incubator-page"
    data-incubator-page
  >
    <IncubatorProductConsole
      :operator="consoleState.operator"
      :projection="consoleState.projection.value"
      :history="consoleState.history.value"
      :snapshot="consoleState.snapshot.value"
      :active-chamber="consoleState.activeChamber.value"
      :local-held-chamber="consoleState.localHeldChamber.value"
      :own-chamber="consoleState.ownChamber.value"
      :phase="consoleState.phase.value"
      :error="consoleState.error.value"
      :last-code="consoleState.lastCode.value"
      :sync-progress="consoleState.syncProgress.value"
      :history-open="consoleState.historyOpen.value"
      :session-loading="consoleState.sessionLoading.value"
      :access-code="consoleState.accessCode.value"
      :generated-session-code="consoleState.generatedSessionCode.value"
      :access-mode="consoleState.accessMode.value"
      :anchors="anchors"
      :hovered-chamber="hoveredChamber"
      :crossing-threshold="consoleState.crossingThreshold.value"
      :airlock-ready="consoleState.airlockReady.value"
      @chamber="consoleState.openChamber"
      @press="consoleState.pressFingerprint"
      @release="consoleState.stopFingerprint"
      @close="onCloseRequest"
      @history="consoleState.openHistory"
      @reset="consoleState.resetConsole"
      @skip="consoleState.skipIntro"
      @open-terminal="consoleState.openAccessTerminal"
      @access-code="consoleState.updateAccessCode"
      @access-submit="consoleState.submitAccessCode"
      @access-mode="consoleState.selectAccessMode"
      @access-back="consoleState.clearAccessMode"
    >
      <PlaygroundScene
        ref="scene"
        class="incubator-page__scene"
        @interact="onSceneInteraction"
        @anchors="anchors = $event"
      />
    </IncubatorProductConsole>

    <div
      v-if="isDev && !consoleState.introActive.value"
      class="incubator-dev"
      data-incubator-dev
    >
      <button
        type="button"
        class="incubator-dev__toggle"
        @click="devOpen = !devOpen"
      >
        DEV
      </button>
      <IncubatorPlaygroundControls
        v-if="devOpen"
        v-model:last-command="consoleState.lastSceneCommand.value"
        :api="api"
      />
    </div>
  </main>
</template>
