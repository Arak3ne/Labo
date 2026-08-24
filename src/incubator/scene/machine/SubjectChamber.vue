<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import { DoubleSide, type Group, type Mesh, type MeshPhysicalMaterial, type MeshStandardMaterial } from "three";
import { computed, onUnmounted, shallowRef } from "vue";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";
import HoloSubject from "./HoloSubject.vue";

const props = defineProps<{
  side: "left" | "right";
}>();

const emit = defineEmits<{
  interact: [event: { target: "left" | "right"; kind: "hover" | "click"; active?: boolean }];
}>();

const visual = useIncubatorVisual();
const chamber = shallowRef<Group | null>(null);
const glass = shallowRef<Mesh | null>(null);
const lockRing = shallowRef<Mesh | null>(null);
const clampA = shallowRef<Mesh | null>(null);
const clampB = shallowRef<Mesh | null>(null);
const hatchA = shallowRef<Mesh | null>(null);
const hatchB = shallowRef<Mesh | null>(null);
const innerGlow = shallowRef<Mesh | null>(null);
const isLeft = props.side === "left";
const holoMaterial = createHoloMaterial(isLeft ? 0x0fb576 : 0x8abfa6, 0.42);
const halfPi = Math.PI / 2;
const rootPos = v3(isLeft ? -2.55 : 2.55, 0, 0);
const basePos = v3(0, 0.14, 0);
const pedestalPos = v3(0, 0.32, 0);
const glassPos = v3(0, 1.28, 0);
const topRingPos = v3(0, 2.38, 0);
const bottomRingPos = v3(0, 0.28, 0);
const subjectPos = v3(0, 1.22, 0);
const lightPos = v3(0, 1.45, 0.15);
const hatchAPos = v3(0.42, 1.28, 0.52);
const hatchBPos = v3(-0.42, 1.28, 0.52);
const innerPos = v3(0, 1.28, 0);
const capTopPos = v3(0, 2.48, 0);
const capBotPos = v3(0, 0.22, 0);
const crownLightPos = v3(0, 2.18, 0);
const ribs = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return {
    index,
    position: v3(Math.cos(angle) * 0.7, 1.22, Math.sin(angle) * 0.7),
    rotationY: -angle,
  };
});
const bolts = Array.from({ length: 6 }, (_, index) => {
  const angle = (index / 6) * Math.PI * 2;
  return {
    index,
    position: v3(Math.cos(angle) * 0.82, 0.2, Math.sin(angle) * 0.82),
  };
});

const { onBeforeRender } = useLoop();

function stop(event: unknown) {
  if (event && typeof event === "object" && "stopPropagation" in event) {
    const candidate = event as {
      stopPropagation?: () => void;
      nativeEvent?: { stopPropagation?: () => void };
    };
    candidate.stopPropagation?.();
    candidate.nativeEvent?.stopPropagation?.();
  }
}

function onHover(active: boolean, event: unknown) {
  stop(event);
  if (isLeft) {
    document.body.style.cursor = "";
    return;
  }
  document.body.style.cursor = active ? "pointer" : "";
  emit("interact", { target: props.side, kind: "hover", active });
}

function onClick(event: unknown) {
  stop(event);
  if (isLeft) return;
  emit("interact", { target: props.side, kind: "click" });
}

const emphasis = computed(() => {
  return isLeft ? visual.leftEmphasis : visual.rightEmphasis;
});
const fingerprint = computed(() => {
  return isLeft ? visual.leftFingerprint : visual.rightFingerprint;
});
const fingerprintScan = computed(() => {
  return isLeft ? visual.leftFingerprintScan : visual.rightFingerprintScan;
});

onBeforeRender(({ elapsed, delta }) => {
  holoMaterial.uniforms.uTime.value = elapsed;
  holoMaterial.uniforms.uScan.value =
    visual.analysis > 0.01 ? visual.scanOffset : fingerprintScan.value;
  holoMaterial.uniforms.uOpacity.value =
    0.08 +
    visual.subjectPresence * 0.4 +
    emphasis.value * 0.24 +
    fingerprint.value * 0.18 +
    visual.lockAmount * 0.12;

  const material = glass.value?.material;
  if (material && !Array.isArray(material)) {
    const physical = material as MeshPhysicalMaterial;
    physical.emissiveIntensity =
      0.02 +
      visual.subjectPresence * 0.36 +
      emphasis.value * 0.3 +
      fingerprint.value * 0.38 +
      visual.analysis * 0.28 +
      visual.innerGlow * 0.18;
    physical.opacity =
      0.18 +
      visual.subjectPresence * 0.08 +
      emphasis.value * 0.06 +
      fingerprint.value * 0.04 +
      visual.lockAmount * 0.08;
    physical.transmission = 0.68 - visual.lockAmount * 0.16 + visual.hatchOpen * 0.08;
  }

  if (lockRing.value) {
    lockRing.value.position.y = 2.38 - visual.lockAmount * 0.42;
  }
  if (clampA.value) {
    clampA.value.rotation.z = (isLeft ? 1 : -1) * (0.18 - visual.lockAmount * 0.42);
  }
  if (clampB.value) {
    clampB.value.rotation.z = (isLeft ? -1 : 1) * (0.18 - visual.lockAmount * 0.42);
  }
  if (hatchA.value) {
    hatchA.value.rotation.y = visual.hatchOpen * 0.78;
  }
  if (hatchB.value) {
    hatchB.value.rotation.y = -visual.hatchOpen * 0.78;
  }
  if (innerGlow.value) {
    const glowMat = innerGlow.value.material;
    if (glowMat && !Array.isArray(glowMat)) {
      const standard = glowMat as MeshStandardMaterial;
      standard.emissiveIntensity =
        (0.05 +
          visual.innerGlow * 0.82 +
          emphasis.value * 0.3 +
          fingerprint.value * 0.56 +
          visual.analysis * 0.52) *
        (1 - visual.blackout);
      standard.opacity =
        0.06 +
        visual.innerGlow * 0.3 +
        fingerprint.value * 0.12 +
        visual.lockAmount * 0.1 +
        visual.subjectPresence * 0.16;
    }
  }
  if (chamber.value) {
    chamber.value.rotation.y += delta * (0.03 + emphasis.value * 0.1);
  }
});

onUnmounted(() => {
  document.body.style.cursor = "";
  holoMaterial.dispose();
});
</script>

<template>
  <TresGroup :position="rootPos">
    <TresMesh
      :position="glassPos"
      @click="onClick"
      @pointerenter="onHover(true, $event)"
      @pointerleave="onHover(false, $event)"
    >
      <TresCylinderGeometry :args="[0.88, 0.88, 2.55, 20]" />
      <TresMeshBasicMaterial
        :transparent="true"
        :opacity="0.001"
        :depth-write="false"
      />
    </TresMesh>
    <TresMesh
      :position="basePos"
      :cast-shadow="true"
    >
      <TresCylinderGeometry :args="[0.78, 0.92, 0.26, 32]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.24"
      />
    </TresMesh>

    <TresMesh :position="pedestalPos">
      <TresCylinderGeometry :args="[0.52, 0.62, 0.16, 24]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh
      v-for="bolt in bolts"
      :key="bolt.index"
      :position="bolt.position"
    >
      <TresCylinderGeometry :args="[0.035, 0.035, 0.08, 8]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.96"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh
      ref="glass"
      :position="glassPos"
    >
      <TresCylinderGeometry :args="[0.64, 0.64, 2.12, 40, 1, true]" />
      <TresMeshPhysicalMaterial
        color="#8ABFA6"
        :emissive="isLeft ? 0x0fb576 : 0x8abfa6"
        :emissive-intensity="0.08"
        :transparent="true"
        :opacity="0.16"
        :metalness="0.08"
        :roughness="0.06"
        :transmission="0.72"
        :thickness="0.45"
        :ior="1.45"
        :side="DoubleSide"
      />
    </TresMesh>

    <TresMesh
      :position="glassPos"
      :material="holoMaterial"
    >
      <TresCylinderGeometry :args="[0.66, 0.66, 2.16, 40, 1, true]" />
    </TresMesh>

    <TresMesh
      ref="innerGlow"
      :position="innerPos"
    >
      <TresCylinderGeometry :args="[0.5, 0.5, 1.85, 28, 1, true]" />
      <TresMeshStandardMaterial
        :color="isLeft ? '#0FB576' : '#8ABFA6'"
        :emissive="isLeft ? 0x0fb576 : 0x8abfa6"
        :emissive-intensity="0.12"
        :transparent="true"
        :opacity="0.1"
        :metalness="0.05"
        :roughness="0.4"
        :side="DoubleSide"
      />
    </TresMesh>

    <TresMesh :position="capTopPos">
      <TresCylinderGeometry :args="[0.68, 0.72, 0.12, 28]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.16"
      />
    </TresMesh>
    <TresMesh :position="capBotPos">
      <TresCylinderGeometry :args="[0.7, 0.78, 0.1, 28]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh
      ref="hatchA"
      :position="hatchAPos"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.52, 1.72, 0.045]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="isLeft ? 0x087d49 : 0x8abfa6"
        :emissive-intensity="0.03 + visual.lockAmount * 0.2 + visual.innerGlow * 0.14"
        :metalness="0.9"
        :roughness="0.18"
      />
    </TresMesh>
    <TresMesh
      ref="hatchB"
      :position="hatchBPos"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.52, 1.72, 0.045]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="isLeft ? 0x0fb576 : 0x8abfa6"
        :emissive-intensity="0.03 + visual.lockAmount * 0.2 + visual.innerGlow * 0.14"
        :metalness="0.9"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh
      v-for="rib in ribs"
      :key="rib.index"
      :position="rib.position"
      :rotation-y="rib.rotationY"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.05, 2.18, 0.08]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.93"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh
      ref="lockRing"
      :position="topRingPos"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.7, 0.055, 12, 48]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="isLeft ? 0x0fb576 : 0x8abfa6"
        :emissive-intensity="0.2 + visual.lockAmount * 0.9 + emphasis * 0.55"
        :metalness="0.94"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh
      :position="bottomRingPos"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.7, 0.06, 12, 48]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="isLeft ? 0x087d49 : 0x8abfa6"
        :emissive-intensity="0.12 + visual.lockAmount * 0.5"
        :metalness="0.94"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh
      ref="clampA"
      :position="v3(isLeft ? -0.78 : 0.78, 1.55, 0.18)"
    >
      <TresBoxGeometry :args="[0.16, 0.55, 0.12]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.92"
        :roughness="0.2"
      />
    </TresMesh>
    <TresMesh
      ref="clampB"
      :position="v3(isLeft ? -0.78 : 0.78, 1.05, -0.18)"
    >
      <TresBoxGeometry :args="[0.16, 0.55, 0.12]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.92"
        :roughness="0.2"
      />
    </TresMesh>

    <TresGroup
      ref="chamber"
      :position="subjectPos"
    >
      <HoloSubject :side="side" />
    </TresGroup>

    <TresPointLight
      :position="lightPos"
      :color="isLeft ? '#0FB576' : '#8ABFA6'"
      :intensity="(0.08 + visual.subjectPresence * 1.45 + emphasis * 0.9 + fingerprint * 1.15 + visual.lockAmount * 0.2 + visual.innerGlow * 0.68) * (1 - visual.blackout)"
      :distance="3"
    />
    <TresPointLight
      :position="crownLightPos"
      :color="isLeft ? '#08995D' : '#FEFEFE'"
      :intensity="(0.05 + visual.subjectPresence * 0.58 + visual.analysis * 0.46) * (1 - visual.blackout)"
      :distance="2.4"
    />
  </TresGroup>
</template>
