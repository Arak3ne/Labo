<script setup lang="ts">
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();

const pylons = Array.from({ length: 4 }, (_, index) => {
  const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
  return {
    index,
    position: v3(Math.cos(angle) * 7.4, 1.15, Math.sin(angle) * 7.4),
    rotation: e3(0, -angle, 0),
  };
});

const halfPi = Math.PI / 2;
const floorPos = v3(0, 0, 0);
const glossPos = v3(0, 0.004, 0);
const ringAPos = v3(0, 0.02, 0);
const hallRingPos = v3(0, 0.055, 0);
const pedestalPos = v3(0, 0.16, 0);
const plinthPos = v3(0, 0.38, 0);
const ceilingPos = v3(0, 5.15, 0);
const farArchPos = v3(0, 2.55, -8.4);
const leftPool = v3(-2.55, 0.012, 0);
const rightPool = v3(2.55, 0.012, 0);
const corePool = v3(0, 0.014, 0);

const rails = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return {
    index,
    position: v3(Math.cos(angle) * 3.2, 4.92, Math.sin(angle) * 3.2),
    rotation: e3(0, -angle, 0),
  };
});
</script>

<template>
  <TresGroup>
    <TresMesh
      :rotation-x="-halfPi"
      :position="floorPos"
      receive-shadow
    >
      <TresCircleGeometry :args="[11.4, 80]" />
      <TresMeshStandardMaterial
        color="#000000"
        :metalness="0.86"
        :roughness="0.22"
      />
    </TresMesh>

    <TresMesh
      :rotation-x="-halfPi"
      :position="glossPos"
      receive-shadow
    >
      <TresCircleGeometry :args="[6.2, 72]" />
      <TresMeshPhysicalMaterial
        color="#011210"
        :metalness="0.96"
        :roughness="0.08"
        :env-map-intensity="1.35"
        :clearcoat="0.72"
        :clearcoat-roughness="0.1"
        :reflectivity="0.9"
      />
    </TresMesh>

    <TresMesh
      :rotation-x="-halfPi"
      :position="ringAPos"
    >
      <TresRingGeometry :args="[1.7, 1.88, 72]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x0FB576"
        :emissive-intensity="0.14 + visual.coreEnergy * 0.28 + visual.revealPower * 0.35"
        :metalness="0.86"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh
      :rotation-x="halfPi"
      :position="hallRingPos"
    >
      <TresTorusGeometry :args="[4.95, 0.07, 12, 96]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="0x087D49"
        :emissive-intensity="0.16 + visual.analysis * 0.38 + visual.coreEnergy * 0.18"
        :metalness="0.88"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh :position="pedestalPos">
      <TresCylinderGeometry :args="[1.55, 1.92, 0.34, 52]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh :position="plinthPos">
      <TresCylinderGeometry :args="[0.82, 1.08, 0.28, 40]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.92"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh :position="farArchPos">
      <TresTorusGeometry :args="[3.35, 0.055, 10, 72]" />
      <TresMeshStandardMaterial
        color="#011210"
        :emissive="0x05603C"
        :emissive-intensity="0.06 + visual.analysis * 0.12"
        :metalness="0.86"
        :roughness="0.32"
      />
    </TresMesh>

    <TresMesh
      v-for="pylon in pylons"
      :key="pylon.index"
      :position="pylon.position"
      :rotation="pylon.rotation"
    >
      <TresBoxGeometry :args="[0.18, 2.3, 0.36]" />
      <TresMeshStandardMaterial
        color="#011210"
        :emissive="0x04452E"
        :emissive-intensity="0.2"
        :metalness="0.82"
        :roughness="0.3"
      />
    </TresMesh>

    <TresMesh
      :rotation-x="halfPi"
      :position="ceilingPos"
    >
      <TresTorusGeometry :args="[4.2, 0.045, 10, 86]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.12 + visual.analysis * 0.25"
        :metalness="0.92"
        :roughness="0.14"
      />
    </TresMesh>

    <TresMesh
      :rotation-x="-halfPi"
      :position="leftPool"
    >
      <TresCircleGeometry :args="[0.72, 36]" />
      <TresMeshStandardMaterial
        color="#000000"
        :emissive="0x0FB576"
        :emissive-intensity="0.05 + visual.leftEmphasis * 0.28 + visual.innerGlow * 0.18"
        :metalness="0.94"
        :roughness="0.08"
        :transparent="true"
        :opacity="0.55"
      />
    </TresMesh>
    <TresMesh
      :rotation-x="-halfPi"
      :position="rightPool"
    >
      <TresCircleGeometry :args="[0.72, 36]" />
      <TresMeshStandardMaterial
        color="#000000"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.05 + visual.rightEmphasis * 0.28 + visual.innerGlow * 0.18"
        :metalness="0.94"
        :roughness="0.08"
        :transparent="true"
        :opacity="0.55"
      />
    </TresMesh>
    <TresMesh
      :rotation-x="-halfPi"
      :position="corePool"
    >
      <TresCircleGeometry :args="[0.95, 40]" />
      <TresMeshStandardMaterial
        color="#000000"
        :emissive="0x0FB576"
        :emissive-intensity="0.04 + visual.coreEnergy * 0.22 + visual.revealPower * 0.3"
        :metalness="0.95"
        :roughness="0.07"
        :transparent="true"
        :opacity="0.5"
      />
    </TresMesh>

    <TresMesh
      v-for="rail in rails"
      :key="rail.index"
      :position="rail.position"
      :rotation="rail.rotation"
    >
      <TresBoxGeometry :args="[0.07, 0.07, 2.35]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.86"
        :roughness="0.2"
      />
    </TresMesh>
  </TresGroup>
</template>
