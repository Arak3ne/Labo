<script setup lang="ts">
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();

const spinePos = v3(0, 1.18, -0.62);
const keelPos = v3(0, 0.42, -0.58);
const rearTruss = v3(0, 1.85, -0.78);
const trayPos = v3(0, 2.08, -0.52);
const junction = v3(0, 1.42, -0.7);
const leftRiser = v3(-1.38, 1.15, -0.55);
const rightRiser = v3(1.38, 1.15, -0.55);
const leftBox = v3(-2.05, 0.62, -0.48);
const rightBox = v3(2.05, 0.62, -0.48);
const leftPanel = v3(-2.55, 0.78, -0.86);
const rightPanel = v3(2.55, 0.78, -0.86);
const leftCollar = v3(-2.55, 0.52, 0);
const rightCollar = v3(2.55, 0.52, 0);
const midCollarL = v3(-2.55, 1.72, 0);
const midCollarR = v3(2.55, 1.72, 0);
const pipeL = v3(-1.95, 0.28, 0.22);
const pipeR = v3(1.95, 0.28, 0.22);
const halfPi = Math.PI / 2;

const brackets = Array.from({ length: 6 }, (_, index) => {
  const x = -2.4 + index * 0.96;
  return {
    index,
    position: v3(x, 2.48, -0.38),
  };
});

const cableDrops = Array.from({ length: 5 }, (_, index) => {
  const x = -1.7 + index * 0.85;
  return {
    index,
    position: v3(x, 1.55, -0.68),
  };
});

const floorPorts = [
  { index: 0, position: v3(-2.55, 0.08, -0.42) },
  { index: 1, position: v3(2.55, 0.08, -0.42) },
  { index: 2, position: v3(-1.1, 0.08, -0.7) },
  { index: 3, position: v3(1.1, 0.08, -0.7) },
];

const servoArms = [
  { index: 0, position: v3(-2.55, 2.02, 0.42), rotation: e3(0.35, 0, 0) },
  { index: 1, position: v3(2.55, 2.02, 0.42), rotation: e3(0.35, 0, 0) },
  { index: 2, position: v3(-2.55, 0.92, 0.58), rotation: e3(-0.4, 0, 0) },
  { index: 3, position: v3(2.55, 0.92, 0.58), rotation: e3(-0.4, 0, 0) },
];
</script>

<template>
  <TresGroup>
    <TresMesh
      :position="spinePos"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[5.2, 0.12, 0.18]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh
      :position="keelPos"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[4.4, 0.1, 0.16]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.22"
      />
    </TresMesh>

    <TresMesh :position="rearTruss">
      <TresBoxGeometry :args="[4.8, 0.07, 0.1]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="0x0FB576"
        :emissive-intensity="0.08 + visual.energyFlow * 0.55 + visual.analysis * 0.25"
        :metalness="0.88"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh :position="trayPos">
      <TresBoxGeometry :args="[3.4, 0.04, 0.28]" />
      <TresMeshStandardMaterial
        color="#000000"
        :metalness="0.86"
        :roughness="0.28"
      />
    </TresMesh>

    <TresMesh :position="junction">
      <TresBoxGeometry :args="[0.42, 0.32, 0.28]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.92"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh
      :position="leftRiser"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.1, 1.85, 0.14]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.93"
        :roughness="0.2"
      />
    </TresMesh>
    <TresMesh
      :position="rightRiser"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.1, 1.85, 0.14]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.93"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh :position="leftBox">
      <TresBoxGeometry :args="[0.34, 0.28, 0.22]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.18"
      />
    </TresMesh>
    <TresMesh :position="rightBox">
      <TresBoxGeometry :args="[0.34, 0.28, 0.22]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh :position="leftPanel">
      <TresBoxGeometry :args="[0.42, 0.55, 0.06]" />
      <TresMeshStandardMaterial
        color="#011210"
        :emissive="0x0FB576"
        :emissive-intensity="0.06 + visual.leftEmphasis * 0.45 + visual.innerGlow * 0.2"
        :metalness="0.84"
        :roughness="0.24"
      />
    </TresMesh>
    <TresMesh :position="rightPanel">
      <TresBoxGeometry :args="[0.42, 0.55, 0.06]" />
      <TresMeshStandardMaterial
        color="#011210"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.06 + visual.rightEmphasis * 0.45 + visual.innerGlow * 0.2"
        :metalness="0.84"
        :roughness="0.24"
      />
    </TresMesh>

    <TresMesh
      :position="leftCollar"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.74, 0.04, 8, 36]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.96"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh
      :position="rightCollar"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.74, 0.04, 8, 36]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.96"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh
      :position="midCollarL"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.76, 0.03, 8, 40]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x0FB576"
        :emissive-intensity="0.15 + visual.lockAmount * 0.7 + visual.leftEmphasis * 0.35"
        :metalness="0.92"
        :roughness="0.16"
      />
    </TresMesh>
    <TresMesh
      :position="midCollarR"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.76, 0.03, 8, 40]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.15 + visual.lockAmount * 0.7 + visual.rightEmphasis * 0.35"
        :metalness="0.92"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh
      :position="pipeL"
      :rotation-z="halfPi"
    >
      <TresCylinderGeometry :args="[0.035, 0.035, 1.15, 10]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.88"
        :roughness="0.22"
      />
    </TresMesh>
    <TresMesh
      :position="pipeR"
      :rotation-z="halfPi"
    >
      <TresCylinderGeometry :args="[0.035, 0.035, 1.15, 10]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.88"
        :roughness="0.22"
      />
    </TresMesh>

    <TresMesh
      v-for="bracket in brackets"
      :key="bracket.index"
      :position="bracket.position"
    >
      <TresBoxGeometry :args="[0.12, 0.16, 0.18]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.9"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh
      v-for="drop in cableDrops"
      :key="drop.index"
      :position="drop.position"
    >
      <TresCylinderGeometry :args="[0.014, 0.018, 1.35, 6]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x087D49"
        :emissive-intensity="0.04 + visual.energyFlow * 0.45"
        :metalness="0.55"
        :roughness="0.4"
      />
    </TresMesh>

    <TresMesh
      v-for="port in floorPorts"
      :key="port.index"
      :position="port.position"
    >
      <TresCylinderGeometry :args="[0.08, 0.1, 0.1, 12]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.95"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh
      v-for="arm in servoArms"
      :key="arm.index"
      :position="arm.position"
      :rotation="arm.rotation"
    >
      <TresBoxGeometry :args="[0.07, 0.42, 0.07]" />
      <TresMeshStandardMaterial
        color="#8ABFA6"
        :metalness="0.96"
        :roughness="0.1"
      />
    </TresMesh>
  </TresGroup>
</template>
