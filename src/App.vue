<script setup lang="ts">
import { onUnmounted } from "vue";
import { destroyMorueVoice } from "./incubator/audio";
import IncubatorAuthGate from "./incubator/ui/IncubatorAuthGate.vue";

onUnmounted(destroyMorueVoice);
</script>

<template>
  <IncubatorAuthGate>
    <Suspense>
      <router-view />
      <template #fallback>
        <main class="incubator-page" />
      </template>
    </Suspense>
  </IncubatorAuthGate>
</template>
