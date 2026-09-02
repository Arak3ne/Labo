<script setup lang="ts">
import { defineAsyncComponent, onUnmounted } from "vue";
import { destroyMorueVoice } from "../audio";
import IncubatorAuthGate from "./IncubatorAuthGate.vue";

const IncubatorPage = defineAsyncComponent(() => import("./IncubatorPage.vue"));

onUnmounted(destroyMorueVoice);
</script>

<template>
  <IncubatorAuthGate>
    <Suspense>
      <IncubatorPage />
      <template #fallback>
        <main class="incubator-page" />
      </template>
    </Suspense>
  </IncubatorAuthGate>
</template>
