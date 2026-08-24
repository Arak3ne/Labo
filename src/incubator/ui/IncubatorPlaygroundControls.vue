<script setup lang="ts">
import type { IncubatorRevealCode, IncubatorSceneApi } from "../types";

const props = defineProps<{
  api: IncubatorSceneApi | null;
}>();

const lastCommand = defineModel<string>("lastCommand", { default: "idle" });

function run(name: string, action: (api: IncubatorSceneApi) => void) {
  if (!props.api) {
    return;
  }
  lastCommand.value = name;
  action(props.api);
}

function reveal(code: IncubatorRevealCode) {
  run(`reveal ${code}`, (api) => {
    api.revealResult(code);
  });
}
</script>

<template>
  <nav
    class="incubator-dev-controls"
    data-incubator-playground-controls
  >
    <p
      class="incubator-dev-controls__cmd"
      data-last-command
    >
      {{ lastCommand }}
    </p>
    <button
      type="button"
      @click="run('morueInit', (api) => api.morueInit())"
    >
      MORUE Init
    </button>
    <button
      type="button"
      @click="run('idle', (api) => api.idle())"
    >
      Idle
    </button>
    <button
      type="button"
      @click="run('focusLeft', (api) => api.focusLeft())"
    >
      Focus Left
    </button>
    <button
      type="button"
      @click="run('focusRight', (api) => api.focusRight())"
    >
      Focus Right
    </button>
    <button
      type="button"
      @click="run('loadSubjects', (api) => api.loadSubjects())"
    >
      Load Subjects
    </button>
    <button
      type="button"
      @click="run('analyze', (api) => api.startAnalysis())"
    >
      Analyze
    </button>
    <button
      type="button"
      @click="reveal('0')"
    >
      Reveal 0
    </button>
    <button
      type="button"
      @click="reveal('1')"
    >
      Reveal 1
    </button>
    <button
      type="button"
      @click="reveal('M')"
    >
      Reveal M
    </button>
    <button
      type="button"
      @click="run('reset', (api) => api.reset())"
    >
      Reset
    </button>
  </nav>
</template>

<style scoped>
.incubator-dev-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.incubator-dev-controls__cmd {
  width: 100%;
  margin: 0 0 0.15rem;
  color: var(--mcu-hologram);
  font-size: 0.62rem;
}

.incubator-dev-controls button {
  padding: 0.28rem 0.45rem;
  border: 1px solid var(--mcu-structure);
  background: transparent;
  color: var(--mcu-hologram);
  font: inherit;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.incubator-dev-controls button:hover,
.incubator-dev-controls button:focus-visible {
  border-color: var(--mcu-active);
  color: var(--mcu-glow);
  outline: none;
}
</style>
