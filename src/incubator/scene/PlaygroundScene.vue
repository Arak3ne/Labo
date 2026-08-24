<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { onUnmounted, ref } from "vue";
import { destroyIncubatorAudio, getIncubatorAudio } from "../audio";
import type { IncubatorSceneApi } from "../types";
import PlaygroundRig from "./PlaygroundRig.vue";
import type { MorueEnterLabOptions, MorueInitOptions } from "./morueSceneApi";
import type { IncubatorSceneInteraction, IncubatorScreenAnchors } from "./sceneEvents";

const emit = defineEmits<{
  interact: [event: IncubatorSceneInteraction];
  anchors: [anchors: IncubatorScreenAnchors];
}>();

const api = ref<IncubatorSceneApi | null>(null);
const audio = getIncubatorAudio();

function onReady(value: IncubatorSceneApi) {
  const introPhases = new Set<"introBoot" | "introIdentify" | "introEnter">();
  let lastAccessCommand:
    | "accessTerminalFocus"
    | "accessScanStart"
    | "accessScanCancel"
    | null = null;
  let accessGrantedPlayed = false;
  const playIntroPhase = (phase: "introBoot" | "introIdentify" | "introEnter") => {
    if (introPhases.has(phase)) return;
    introPhases.add(phase);
    audio[phase]();
    value[phase]();
  };

  api.value = {
    morueInit(options?: MorueInitOptions) {
      audio.introBoot();
      value.morueInit(options);
    },
    resumeMorueInit() {
      value.resumeMorueInit();
    },
    finishMorueInit() {
      value.finishMorueInit();
    },
    enterLab(options?: MorueEnterLabOptions) {
      audio.introEnter();
      value.enterLab(options);
    },
    introBoot() {
      playIntroPhase("introBoot");
    },
    introIdentify() {
      playIntroPhase("introIdentify");
    },
    introEnter() {
      playIntroPhase("introEnter");
    },
    idle() {
      audio.idle();
      value.idle();
    },
    focusLeft() {
      audio.focusLeft();
      value.focusLeft();
    },
    focusRight() {
      audio.focusRight();
      value.focusRight();
    },
    fingerprintFocus(chamber) {
      audio.fingerprintFocus(chamber);
      value.fingerprintFocus(chamber);
    },
    fingerprintPress(chamber) {
      audio.fingerprintPress(chamber);
      value.fingerprintPress(chamber);
    },
    fingerprintRelease(chamber) {
      audio.fingerprintRelease(chamber);
      value.fingerprintRelease(chamber);
    },
    fingerprintSync() {
      audio.fingerprintSync();
      value.fingerprintSync();
    },
    fingerprintConfirmed() {
      audio.fingerprintConfirmed();
      value.fingerprintConfirmed();
    },
    accessTerminalFocus() {
      if (lastAccessCommand === "accessTerminalFocus") return;
      lastAccessCommand = "accessTerminalFocus";
      audio.accessTerminalFocus();
      value.accessTerminalFocus();
    },
    accessScanStart() {
      if (lastAccessCommand === "accessScanStart") return;
      lastAccessCommand = "accessScanStart";
      audio.accessScanStart();
      value.accessScanStart();
    },
    accessScanCancel() {
      if (lastAccessCommand === "accessScanCancel") return;
      lastAccessCommand = "accessScanCancel";
      audio.accessScanCancel();
      value.accessScanCancel();
    },
    accessGranted() {
      if (accessGrantedPlayed) return;
      accessGrantedPlayed = true;
      lastAccessCommand = null;
      audio.accessGranted();
      value.accessGranted();
    },
    loadSubjects() {
      audio.loadSubjects();
      value.loadSubjects();
    },
    startAnalysis() {
      audio.startAnalysis();
      value.startAnalysis();
    },
    revealResult(code) {
      audio.revealResult(code);
      value.revealResult(code);
    },
    reset() {
      lastAccessCommand = "accessTerminalFocus";
      accessGrantedPlayed = false;
      audio.reset();
      value.reset();
    },
  };
}

defineExpose({
  api,
});

onUnmounted(() => {
  destroyIncubatorAudio();
});
</script>

<template>
  <div
    data-incubator-playground-scene
    class="incubator-scene-stage"
  >
    <TresCanvas
      clear-color="#000403"
      :window-size="false"
      :shadows="true"
    >
      <PlaygroundRig
        @ready="onReady"
        @interact="emit('interact', $event)"
        @anchors="emit('anchors', $event)"
      />
    </TresCanvas>
  </div>
</template>

<style scoped>
.incubator-scene-stage {
  width: 100%;
  height: 100%;
  min-height: 70vh;
}
</style>
