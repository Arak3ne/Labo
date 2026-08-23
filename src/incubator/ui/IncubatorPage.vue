<script setup lang="ts">
import gsap from "gsap";
import { onMounted, onUnmounted, ref } from "vue";
import IncubatorProbeScene from "../scene/IncubatorProbeScene.vue";

const gsapProbe = ref<HTMLElement | null>(null);
const gsapReady = ref(false);
let probeTween: gsap.core.Tween | null = null;

onMounted(() => {
  if (!gsapProbe.value) {
    return;
  }

  probeTween = gsap.fromTo(
    gsapProbe.value,
    { opacity: 0.2 },
    {
      opacity: 1,
      duration: 0.45,
      onComplete() {
        gsapReady.value = true;
      },
    },
  );
});

onUnmounted(() => {
  probeTween?.kill();
});
</script>

<template>
  <section data-incubator-page>
    <p
      ref="gsapProbe"
      data-gsap-probe
      :data-gsap-ready="String(gsapReady)"
    >
      incubator-gsap
    </p>
    <IncubatorProbeScene />
  </section>
</template>
