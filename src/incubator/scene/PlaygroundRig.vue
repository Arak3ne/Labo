<script setup lang="ts">
import { ContactShadows } from "@tresjs/cientos";
import { useLoop, useTres } from "@tresjs/core";
import gsap from "gsap";
import { Color, FogExp2, Vector3 } from "three";
import { onMounted, onUnmounted, provide, reactive } from "vue";
import type {
  IncubatorChamber,
  IncubatorRevealCode,
  IncubatorSceneApi,
} from "../types";
import type { MorueEnterLabOptions, MorueInitAct, MorueInitOptions } from "./morueSceneApi";
import type { IncubatorSceneInteraction, IncubatorScreenAnchors } from "./sceneEvents";
import CinematicComposer from "./fx/CinematicComposer.vue";
import LabAirlock from "./fx/LabAirlock.vue";
import MorueGlyph from "./fx/MorueGlyph.vue";
import MorueVoid from "./fx/MorueVoid.vue";
import IncubatorMachine from "./machine/IncubatorMachine.vue";
import { v3 } from "./threeProps";
import {
  createIdleVisualState,
  incubatorVisualKey,
  restTint,
  revealTint,
  syncPostFx,
} from "./visualState";

const emit = defineEmits<{
  ready: [api: IncubatorSceneApi];
  interact: [event: IncubatorSceneInteraction];
  anchors: [anchors: IncubatorScreenAnchors];
}>();

const { camera, scene } = useTres();
const visual = reactive(createIdleVisualState());
provide(incubatorVisualKey, visual);

const SCALE = 1.28;
const LEFT_X = -2.55 * SCALE;
const RIGHT_X = 2.55 * SCALE;
const CORE_Y = 1.72 * SCALE;

const idleCam = { x: 0.18, y: 2.72, z: 8.85 };
const idleLook = { x: 0, y: CORE_Y * 0.78, z: 0 };
const introBootCam = { x: -4.4, y: 5.1, z: 15.8 };
const introBootLook = { x: -0.2, y: CORE_Y * 0.92, z: 0 };
const introThresholdCam = { x: -2.25, y: 3.95, z: 12.4 };
const introThresholdLook = { x: 0, y: CORE_Y * 0.86, z: 0 };
const introOverviewCam = { x: 0.12, y: 2.62, z: 8.35 };
const introOverviewLook = { x: 0, y: CORE_Y * 0.82, z: 0 };
const morueWakeCam = { x: -1.28, y: 1.72, z: 6.55 };
const morueWakeLook = { x: 0.78, y: 1.74, z: 0 };
const morueIdentifyCam = { x: -1.05, y: 1.68, z: 5.85 };
const morueIdentifyLook = { x: 0.86, y: 1.76, z: 0 };
const airlockCam = { x: 0.04, y: 1.86, z: 10.05 };
const airlockLook = { x: 0, y: 1.68, z: 6.2 };
const accessTerminalCam = { x: 6.05, y: 1.72, z: 3.65 };
const accessTerminalLook = { x: 5.25, y: 0.72, z: 0 };
const camPos = { ...idleCam };
const look = { ...idleLook };
const shake = { amp: 0 };
const lightMul = reactive({ value: 1 });
const restColor = restTint();
const cameraStart = v3(idleCam.x, idleCam.y, idleCam.z);
const keyLightPos = v3(2.8, 6.4, 4.2);
const rimLightPos = v3(-3.4, 3.8, -4.6);
const leftSpotPos = v3(LEFT_X, 4.8, 2.1);
const rightSpotPos = v3(RIGHT_X, 4.8, 2.1);
const fillPos = v3(0.4, 1.2, 5.2);
const machineScale = v3(SCALE, SCALE, SCALE);
let master: gsap.core.Timeline | null = null;
let introHoldSkip = false;
let introHoldSafety: number | null = null;
const fingerprintTimelines: Record<
  IncubatorChamber,
  gsap.core.Timeline | null
> = {
  left: null,
  right: null,
};
let interactionsLocked = false;
let accessSessionGranted = false;
let accessGrantPresented = false;
let fingerprintSyncActive = false;
let lastAnchorUpdate = 0;
const anchorWorld = {
  left: new Vector3(LEFT_X, 1.72 * SCALE, 0),
  right: new Vector3(RIGHT_X, 1.72 * SCALE, 0),
  core: new Vector3(0, CORE_Y, 0),
  terminal: new Vector3(4.25 * SCALE, 0.45 * SCALE, 0),
  threshold: new Vector3(0, 1.82, 6.55),
};

function stopCurrentAnimation() {
  master?.kill();
  master = null;
  fingerprintTimelines.left?.kill();
  fingerprintTimelines.right?.kill();
  fingerprintTimelines.left = null;
  fingerprintTimelines.right = null;
  gsap.killTweensOf([camPos, look, shake, visual]);
}

function playFingerprint(
  chamber: IncubatorChamber,
  build: (timeline: gsap.core.Timeline) => void,
) {
  fingerprintTimelines[chamber]?.kill();
  const timeline = gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: () => {
      if (fingerprintTimelines[chamber] === timeline) {
        fingerprintTimelines[chamber] = null;
      }
    },
  });
  fingerprintTimelines[chamber] = timeline;
  build(timeline);
}

function fingerprintKeys(chamber: IncubatorChamber) {
  return chamber === "left"
    ? {
        emphasis: "leftEmphasis",
        fingerprint: "leftFingerprint",
        scan: "leftFingerprintScan",
        energy: "leftFingerprintEnergy",
      }
    : {
        emphasis: "rightEmphasis",
        fingerprint: "rightFingerprint",
        scan: "rightFingerprintScan",
        energy: "rightFingerprintEnergy",
      };
}

function play(build: (timeline: gsap.core.Timeline) => void, onComplete?: () => void) {
  stopCurrentAnimation();
  if (visual.phase !== "morueInit" && visual.phase !== "introEnter") {
    gsap.set(visual, { moruePresence: 0, diagnosticScan: 0 });
  }
  const timeline = gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: () => {
      if (master === timeline) {
        master = null;
        onComplete?.();
      }
    },
  });
  master = timeline;
  build(timeline);
}

function forwardInteraction(event: IncubatorSceneInteraction) {
  if (event.target === "threshold" || event.target === "terminal") {
    emit("interact", event);
    return;
  }
  if (accessSessionGranted && !interactionsLocked) {
    emit("interact", event);
  }
}

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  const active = camera.value;
  if (!active) {
    return;
  }
  const live = 1 - visual.blackout;
  lightMul.value =
    visual.flicker > 0.55 && Math.random() < 0.04 ? 1 - visual.flicker * 0.28 : 1;
  let driftX = 0;
  let driftY = 0;
  let driftZ = 0;
  if (visual.idleDrift > 0.01 && visual.phase === "idle") {
    driftX = Math.sin(elapsed * 0.13) * 0.16 * visual.idleDrift;
    driftY = Math.sin(elapsed * 0.09) * 0.05 * visual.idleDrift;
    driftZ = Math.cos(elapsed * 0.11) * 0.1 * visual.idleDrift;
  }
  const jx = (Math.random() - 0.5) * shake.amp + driftX;
  const jy = (Math.random() - 0.5) * shake.amp * 0.55 + driftY;
  active.position.set(camPos.x + jx, camPos.y + jy, camPos.z + driftZ);
  active.lookAt(look.x, look.y, look.z);

  if (scene.value) {
    const fog = scene.value.fog;
    if (fog instanceof FogExp2) {
      fog.density = 0.018 + visual.blackout * 0.08 + visual.labPresence * 0.016 + visual.analysis * 0.008;
      fog.color.setRGB(
        0.002 * live,
        (0.012 + visual.labPresence * 0.058) * live,
        (0.01 + visual.labPresence * 0.052) * live,
      );
    }
    const background = scene.value.background;
    if (background instanceof Color) {
      background.setRGB(
        0.002 * live,
        (0.012 + visual.labPresence * 0.058) * live,
        (0.01 + visual.labPresence * 0.052) * live,
      );
    }
  }
  syncPostFx(visual);

  if (elapsed - lastAnchorUpdate >= 0.05) {
    lastAnchorUpdate = elapsed;
    const project = (point: Vector3) => {
      const projected = point.clone().project(active);
      return {
        x: (projected.x * 0.5 + 0.5) * window.innerWidth,
        y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
        visible: projected.z >= -1 && projected.z <= 1,
      };
    };
    emit("anchors", {
      left: project(anchorWorld.left),
      right: project(anchorWorld.right),
      core: project(anchorWorld.core),
      terminal: project(anchorWorld.terminal),
      threshold: project(anchorWorld.threshold),
    });
  }
});

function moveCamera(
  timeline: gsap.core.Timeline,
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  duration = 1.05,
  positionEase = "power3.inOut",
  at = 0,
) {
  timeline.to(camPos, { ...position, duration, ease: positionEase }, at);
  timeline.to(look, { ...target, duration, ease: positionEase }, at);
}

function clearIntroHoldSafety() {
  if (introHoldSafety !== null) {
    window.clearTimeout(introHoldSafety);
    introHoldSafety = null;
  }
}

function resumeMorueInitHold() {
  if (master?.paused()) {
    clearIntroHoldSafety();
    master.resume();
    return;
  }
  introHoldSkip = true;
}

function holdIntro(timeline: gsap.core.Timeline, atTime: number) {
  timeline.call(
    () => {
      if (introHoldSkip) {
        introHoldSkip = false;
        return;
      }
      timeline.pause();
      clearIntroHoldSafety();
        introHoldSafety = window.setTimeout(() => {
        introHoldSafety = null;
        if (master === timeline && timeline.paused()) timeline.resume();
      }, 20_000);
    },
    undefined,
    atTime,
  );
}

function settleMorueIntro() {
  gsap.set(camPos, introOverviewCam);
  gsap.set(look, introOverviewLook);
  gsap.set(shake, { amp: 0 });
  gsap.set(visual, {
    subjectPresence: 0,
    leftEmphasis: 0,
    rightEmphasis: 0,
    analysis: 0,
    ringVelocity: 0.12,
    coreEnergy: 0.32,
    revealPower: 0,
    scanVisible: 0,
    scanOffset: 0,
    glyphOpacity: 0,
    lockAmount: 0,
    hatchOpen: 0.84,
    innerGlow: 0.18,
    vapor: 0.12,
    flicker: 0,
    residualScan: 0,
    energyFlow: 0.16,
    blackout: 0,
    glitch: 0,
    chroma: 0,
    bloom: 0.36,
    idleDrift: 0.24,
    pulse: 0.34,
    keyIntensity: 0.2,
    moruePresence: 0,
    diagnosticScan: 0,
    airlockPresence: 0,
    airlockOpen: 0,
    labPresence: 1,
  });
  visual.phase = "idle";
  interactionsLocked = !accessSessionGranted;
}

function holdAtAirlock() {
  gsap.set(camPos, airlockCam);
  gsap.set(look, airlockLook);
  gsap.set(shake, { amp: 0 });
  visual.airlockPresence = 1;
  visual.airlockOpen = 0;
  visual.moruePresence = 0;
  visual.labPresence = 0;
  visual.phase = "introEnter";
  interactionsLocked = true;
}

const api: IncubatorSceneApi = {
  morueInit(options?: MorueInitOptions) {
    const reducedMotion = options?.reducedMotion === true;
    const total = reducedMotion ? 2.8 : 8;
    const at = (seconds: number) => (seconds / 8) * total;

    interactionsLocked = true;
    fingerprintSyncActive = false;
    visual.phase = "morueInit";
    visual.revealCode = null;
    visual.labPresence = 0;
    introHoldSkip = false;
    clearIntroHoldSafety();

    play(
      (timeline) => {
        const notify = (act: MorueInitAct) => {
          options?.onAct?.(act);
        };
        timeline.addLabel("wake", 0);
        timeline.call(() => notify("wake"), undefined, 0);
        gsap.set(camPos, morueWakeCam);
        gsap.set(look, morueWakeLook);
        gsap.set(shake, { amp: 0 });
        gsap.set(visual, {
          subjectPresence: 0,
          leftEmphasis: 0,
          rightEmphasis: 0,
          analysis: 0,
          ringVelocity: 0,
          coreEnergy: 0.015,
          revealPower: 0,
          scanVisible: 0,
          scanOffset: 0,
          glyphOpacity: 0,
          lockAmount: 0,
          hatchOpen: 0.84,
          innerGlow: 0.005,
          vapor: 0.02,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0,
          glitch: 0,
          chroma: 0,
          idleDrift: 0,
          pulse: 0.08,
          keyIntensity: 0,
          moruePresence: 0,
          diagnosticScan: 0,
          airlockPresence: 0,
          airlockOpen: 0,
          labPresence: 0,
          blackout: 0.12,
          bloom: 0.18,
        });
        moveCamera(
          timeline,
          { x: -1.12, y: 1.7, z: 6.12 },
          morueWakeLook,
          at(1.9),
          "power2.inOut",
          0,
        );
        timeline.to(
          visual,
          {
            diagnosticScan: 0.85,
            blackout: 0.04,
            bloom: 0.62,
            pulse: 0.42,
            duration: at(1.4),
            ease: "power2.out",
          },
          at(0.12),
        );
        timeline.to(
          visual,
          {
            moruePresence: 1,
            duration: at(0.42),
            ease: "power2.out",
          },
          0,
        );
        timeline.to(
          visual,
          {
            diagnosticScan: 1,
            duration: at(0.55),
            ease: "sine.out",
          },
          at(1.65),
        );
        holdIntro(timeline, at(0.7));

        timeline.addLabel("threshold", at(2.2));
        timeline.call(() => notify("identify"), undefined, at(2.2));
        moveCamera(
          timeline,
          morueIdentifyCam,
          morueIdentifyLook,
          at(2.6),
          "power3.inOut",
          at(2.2),
        );
        timeline.to(
          visual,
          {
            blackout: 0.02,
            diagnosticScan: 1,
            pulse: 0.55,
            bloom: 0.72,
            chroma: reducedMotion ? 0 : 0.08,
            duration: at(2.6),
            ease: "power2.inOut",
          },
          at(2.2),
        );
        holdIntro(timeline, at(2.95));

        timeline.addLabel("overview", at(5));
        timeline.call(() => notify("overview"), undefined, at(5));
        timeline.to(
          visual,
          {
            moruePresence: 0,
            diagnosticScan: 0,
            duration: at(0.7),
            ease: "power2.in",
          },
          at(5),
        );
        timeline.to(
          visual,
          {
            airlockPresence: 1,
            duration: at(0.9),
            ease: "power2.out",
          },
          at(5.15),
        );
        moveCamera(
          timeline,
          airlockCam,
          airlockLook,
          at(1.85),
          "power3.inOut",
          at(5),
        );
        timeline.to(
          visual,
          {
            blackout: 0.12,
            bloom: 0.38,
            chroma: 0,
            keyIntensity: 0,
            labPresence: 0,
            duration: at(1.85),
            ease: "sine.out",
          },
          at(5),
        );
        if (!reducedMotion) {
          timeline.to(shake, { amp: 0.008, duration: 0.08 }, at(6.52));
          timeline.to(shake, { amp: 0, duration: 0.34, ease: "power2.out" }, at(6.6));
        }
      },
      () => {
        holdAtAirlock();
        options?.onAct?.("threshold");
      },
    );
  },
  resumeMorueInit() {
    resumeMorueInitHold();
  },
  finishMorueInit() {
    introHoldSkip = false;
    clearIntroHoldSafety();
    stopCurrentAnimation();
    settleMorueIntro();
  },
  enterLab(options?: MorueEnterLabOptions) {
    const reduced = options?.reducedMotion === true;
    const duration = reduced ? 1.15 : 2.65;
    introHoldSkip = false;
    clearIntroHoldSafety();
    interactionsLocked = true;
    visual.phase = "introEnter";
    visual.revealCode = null;
    play(
      (timeline) => {
        timeline.to(
          visual,
          {
            airlockOpen: 1,
            bloom: 0.52,
            keyIntensity: 0.28,
            coreEnergy: 0.4,
            duration: duration * 0.34,
            ease: "power2.in",
          },
          0,
        );
        moveCamera(
          timeline,
          idleCam,
          idleLook,
          duration * 0.82,
          "power2.inOut",
          0.08,
        );
        if (!reduced) {
          timeline.to(visual, { blackout: 0.92, chroma: 0.08, duration: 0.14, ease: "power2.in" }, duration * 0.22);
          timeline.to(visual, { labPresence: 1, duration: 0.22, ease: "none" }, duration * 0.28);
          timeline.to(shake, { amp: 0.016, duration: 0.08 }, duration * 0.34);
          timeline.to(shake, { amp: 0, duration: 0.28, ease: "power2.out" }, duration * 0.42);
        } else {
          timeline.to(visual, { labPresence: 1, duration: 0.2 }, duration * 0.28);
        }
        timeline.to(
          visual,
          {
            blackout: 0.1,
            chroma: 0,
            bloom: 0.32,
            keyIntensity: 0.18,
            duration: duration * 0.22,
            ease: "power2.out",
          },
          duration * 0.52,
        );
        timeline.to(
          visual,
          {
            airlockPresence: 0,
            idleDrift: 0.42,
            keyIntensity: 0.16,
            duration: duration * 0.28,
            ease: "sine.out",
          },
          duration * 0.62,
        );
      },
      () => {
        visual.airlockPresence = 0;
        visual.airlockOpen = 1;
        visual.labPresence = 1;
        visual.accessTerminal = 0;
        visual.phase = "idle";
        visual.idleDrift = 0.42;
        options?.onComplete?.();
      },
    );
  },
  introBoot() {
    interactionsLocked = true;
    visual.phase = "introBoot";
    visual.revealCode = null;
    play((timeline) => {
      moveCamera(timeline, introBootCam, introBootLook, 1.4, "power2.inOut");
      timeline.to(
        visual,
        {
          subjectPresence: 0.02,
          leftEmphasis: 0,
          rightEmphasis: 0,
          analysis: 0,
          ringVelocity: 0.02,
          coreEnergy: 0.04,
          revealPower: 0,
          scanVisible: 0,
          scanOffset: 0,
          glyphOpacity: 0,
          lockAmount: 0,
          hatchOpen: 0.84,
          innerGlow: 0.01,
          vapor: 0.03,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0,
          blackout: 0.64,
          glitch: 0,
          chroma: 0,
          bloom: 0.08,
          idleDrift: 0,
          pulse: 0.08,
          keyIntensity: 0.025,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.72,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(shake, { amp: 0, duration: 0.2 }, 0);
    });
  },
  introIdentify() {
    interactionsLocked = true;
    visual.phase = "introIdentify";
    visual.revealCode = null;
    play((timeline) => {
      moveCamera(
        timeline,
        introThresholdCam,
        introThresholdLook,
        2.5,
        "power2.inOut",
      );
      timeline.to(
        visual,
        {
          blackout: 0.43,
          coreEnergy: 0.2,
          ringVelocity: 0.075,
          energyFlow: 0.07,
          innerGlow: 0.06,
          vapor: 0.07,
          pulse: 0.24,
          keyIntensity: 0.075,
          bloom: 0.2,
          leftEmphasis: 0.025,
          rightEmphasis: 0.015,
          idleDrift: 0,
          duration: 2.2,
          ease: "power2.inOut",
        },
        0.18,
      );
    });
  },
  introEnter() {
    interactionsLocked = true;
    visual.phase = "introEnter";
    visual.revealCode = null;
    play(
      (timeline) => {
        moveCamera(
          timeline,
          introOverviewCam,
          introOverviewLook,
          3.7,
          "power2.inOut",
        );
        timeline.to(
          visual,
          {
            blackout: 0.18,
            coreEnergy: 0.3,
            ringVelocity: 0.12,
            energyFlow: 0.14,
            innerGlow: 0.12,
            vapor: 0.12,
            pulse: 0.34,
            keyIntensity: 0.17,
            bloom: 0.32,
            leftEmphasis: 0,
            rightEmphasis: 0,
            subjectPresence: 0,
            lockAmount: 0,
            hatchOpen: 0.84,
            analysis: 0,
            revealPower: 0,
            scanVisible: 0,
            glyphOpacity: 0,
            idleDrift: 0,
            duration: 2.45,
            ease: "power2.inOut",
          },
          0,
        );
        timeline.to(
          visual,
          {
            blackout: 0,
            leftEmphasis: 0,
            rightEmphasis: 0,
            coreEnergy: 0.32,
            innerGlow: 0.18,
            keyIntensity: 0.2,
            bloom: 0.36,
            energyFlow: 0.16,
            duration: 1.25,
            ease: "sine.out",
          },
          2.45,
        );
      },
      () => {
        visual.phase = "idle";
        visual.idleDrift = 0.24;
        interactionsLocked = !accessSessionGranted;
      },
    );
  },
  idle() {
    fingerprintSyncActive = false;
    interactionsLocked = !accessSessionGranted;
    visual.phase = "idle";
    visual.revealCode = null;
    play((timeline) => {
      moveCamera(timeline, idleCam, idleLook, 1.35);
      timeline.to(
        visual,
        {
          subjectPresence: 0,
          leftEmphasis: 0,
          rightEmphasis: 0,
          analysis: 0,
          ringVelocity: 0.12,
          coreEnergy: 0.26,
          revealPower: 0,
          scanVisible: 0,
          scanOffset: 0,
          glyphOpacity: 0,
          lockAmount: 0,
          hatchOpen: 0.84,
          innerGlow: 0.09,
          vapor: 0.1,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0,
          blackout: 0,
          glitch: 0,
          chroma: 0,
          bloom: 0.34,
          idleDrift: 1,
          pulse: 0.32,
          leftFingerprint: 0,
          rightFingerprint: 0,
          leftFingerprintScan: 0,
          rightFingerprintScan: 0,
          leftFingerprintEnergy: 0,
          rightFingerprintEnergy: 0,
          fingerprintSync: 0,
          accessTerminal: accessSessionGranted ? 0.28 : 0,
          accessScan: 0,
          accessUnlock: accessSessionGranted ? 0.4 : 0,
          keyIntensity: 0.18,
          moruePresence: 0,
          diagnosticScan: 0,
          airlockPresence: 0,
          labPresence: 1,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.9,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(shake, { amp: 0, duration: 0.28 }, 0);
      timeline.to(
        visual,
        {
          coreEnergy: 0.36,
          pulse: 0.44,
          duration: 4.2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        },
        0.8,
      );
    });
  },
  focusLeft() {
    interactionsLocked = !accessSessionGranted;
    visual.phase = "focusLeft";
    play((timeline) => {
      moveCamera(
        timeline,
        { x: LEFT_X + 0.18, y: 1.58, z: 2.68 },
        { x: LEFT_X, y: 1.42, z: 0 },
        1.08,
      );
      timeline.to(
        visual,
        {
          leftEmphasis: 1,
          rightEmphasis: 0.04,
          coreEnergy: 0.36,
          ringVelocity: 0.2,
          analysis: 0,
          scanVisible: 0,
          scanOffset: 0,
          revealPower: 0,
          glyphOpacity: 0,
          idleDrift: 0,
          blackout: 0,
          chroma: 0,
          glitch: 0,
          bloom: 0.48,
          lockAmount: 0.18,
          hatchOpen: 0.9,
          innerGlow: 0.48,
          vapor: 0.22,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0.12,
          pulse: 0.42,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.75,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(visual, { keyIntensity: 0.28, duration: 0.45 }, 0);
    });
  },
  focusRight() {
    interactionsLocked = !accessSessionGranted;
    visual.phase = "focusRight";
    play((timeline) => {
      moveCamera(
        timeline,
        { x: RIGHT_X - 0.18, y: 1.58, z: 2.68 },
        { x: RIGHT_X, y: 1.42, z: 0 },
        1.08,
      );
      timeline.to(
        visual,
        {
          rightEmphasis: 1,
          leftEmphasis: 0.04,
          coreEnergy: 0.36,
          ringVelocity: 0.2,
          analysis: 0,
          scanVisible: 0,
          scanOffset: 0,
          revealPower: 0,
          glyphOpacity: 0,
          idleDrift: 0,
          blackout: 0,
          chroma: 0,
          glitch: 0,
          bloom: 0.48,
          lockAmount: 0.18,
          hatchOpen: 0.9,
          innerGlow: 0.48,
          vapor: 0.22,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0.12,
          pulse: 0.42,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.75,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(visual, { keyIntensity: 0.28, duration: 0.45 }, 0);
    });
  },
  fingerprintFocus(chamber: IncubatorChamber) {
    if (!accessSessionGranted || interactionsLocked || visual.phase === "analyze") return;
    visual.phase = "fingerprint";
    const keys = fingerprintKeys(chamber);
    playFingerprint(chamber, (timeline) => {
      timeline.to(
        visual,
        {
          [keys.emphasis]: 0.24,
          [keys.fingerprint]: Math.max(
            visual[keys.fingerprint as keyof typeof visual] as number,
            0.06,
          ),
          duration: 0.34,
          ease: "sine.out",
        },
        0,
      );
    });
  },
  fingerprintPress(chamber: IncubatorChamber) {
    if (!accessSessionGranted || interactionsLocked || visual.phase === "analyze") return;
    visual.phase = "fingerprint";
    const keys = fingerprintKeys(chamber);
    playFingerprint(chamber, (timeline) => {
      timeline.to(
        visual,
        {
          [keys.emphasis]: 0.56,
          [keys.fingerprint]: 1,
          [keys.energy]: 0.72,
          innerGlow: Math.max(visual.innerGlow, 0.18),
          duration: 0.48,
          ease: "power2.out",
        },
        0,
      );
      timeline.fromTo(
        visual,
        { [keys.scan]: 0 },
        {
          [keys.scan]: 1,
          duration: 0.92,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        },
        0.08,
      );
    });
  },
  fingerprintRelease(chamber: IncubatorChamber) {
    if (visual.phase === "analyze") return;
    if (fingerprintSyncActive) {
      fingerprintSyncActive = false;
      interactionsLocked = false;
      visual.phase = "idle";
      play((timeline) => {
        timeline.to(
          visual,
          {
            leftFingerprint: 0,
            rightFingerprint: 0,
            leftFingerprintScan: 0,
            rightFingerprintScan: 0,
            leftFingerprintEnergy: 0,
            rightFingerprintEnergy: 0,
            fingerprintSync: 0,
            leftEmphasis: 0,
            rightEmphasis: 0,
            coreEnergy: 0.26,
            ringVelocity: 0.12,
            innerGlow: 0.09,
            bloom: 0.34,
            duration: 0.42,
            ease: "power2.out",
          },
          0,
        );
      });
      return;
    }
    const keys = fingerprintKeys(chamber);
    playFingerprint(chamber, (timeline) => {
      timeline.to(
        visual,
        {
          [keys.emphasis]: 0,
          [keys.fingerprint]: 0,
          [keys.scan]: 0,
          [keys.energy]: 0,
          duration: 0.4,
          ease: "power2.out",
        },
        0,
      );
    });
  },
  fingerprintSync() {
    if (!accessSessionGranted || interactionsLocked || visual.phase === "analyze") return;
    stopCurrentAnimation();
    fingerprintSyncActive = true;
    interactionsLocked = false;
    visual.phase = "fingerprintSync";
    play((timeline) => {
      timeline.to(
        visual,
        {
          leftFingerprint: 0.9,
          rightFingerprint: 0.9,
          leftEmphasis: 0.68,
          rightEmphasis: 0.68,
          leftFingerprintEnergy: 0.82,
          rightFingerprintEnergy: 0.82,
          ringVelocity: 0.34,
          coreEnergy: 0.44,
          duration: 0.52,
          ease: "power2.out",
        },
        0,
      );
      timeline.fromTo(
        visual,
        {
          leftFingerprintScan: 0.08,
          rightFingerprintScan: 0.08,
          fingerprintSync: 0,
        },
        {
          leftFingerprintScan: 0.92,
          rightFingerprintScan: 0.92,
          fingerprintSync: 1,
          leftFingerprintEnergy: 1,
          rightFingerprintEnergy: 1,
          ringVelocity: 0.66,
          coreEnergy: 0.68,
          duration: 1.28,
          ease: "power2.inOut",
        },
        0.52,
      );
    });
  },
  fingerprintConfirmed() {
    if (visual.phase === "analyze") return;
    stopCurrentAnimation();
    fingerprintSyncActive = false;
    interactionsLocked = true;
    visual.phase = "fingerprintConfirmed";
    gsap.set(visual, {
      leftFingerprint: 1,
      rightFingerprint: 1,
      leftFingerprintEnergy: 0.72,
      rightFingerprintEnergy: 0.72,
      fingerprintSync: 1,
      leftEmphasis: 0.82,
      rightEmphasis: 0.82,
      lockAmount: 0.7,
      hatchOpen: 0.12,
      coreEnergy: 0.72,
      ringVelocity: 0.48,
      innerGlow: 0.88,
    });
  },
  accessTerminalFocus() {
    fingerprintSyncActive = false;
    interactionsLocked = true;
    visual.phase = "accessTerminal";
    visual.revealCode = null;
    play((timeline) => {
      moveCamera(
        timeline,
        accessTerminalCam,
        accessTerminalLook,
        1.28,
        "power3.inOut",
      );
      timeline.to(
        visual,
        {
          subjectPresence: 0,
          leftEmphasis: 0,
          rightEmphasis: 0,
          analysis: 0,
          scanVisible: 0,
          scanOffset: 0,
          revealPower: 0,
          glyphOpacity: 0,
          lockAmount: 0,
          hatchOpen: 0.84,
          flicker: 0,
          residualScan: 0,
          blackout: 0,
          glitch: 0,
          chroma: 0,
          vapor: 0.1,
          leftFingerprint: 0,
          rightFingerprint: 0,
          leftFingerprintScan: 0,
          rightFingerprintScan: 0,
          leftFingerprintEnergy: 0,
          rightFingerprintEnergy: 0,
          fingerprintSync: 0,
          accessTerminal: 1,
          accessScan: 0,
          accessUnlock: accessSessionGranted ? 0.4 : 0,
          ringVelocity: 0.07,
          coreEnergy: 0.18,
          energyFlow: 0.06,
          innerGlow: 0.06,
          bloom: 0.3,
          pulse: 0.22,
          keyIntensity: 0.14,
          idleDrift: 0,
          labPresence: 1,
          airlockPresence: 0,
          moruePresence: 0,
          diagnosticScan: 0,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.9,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(shake, { amp: 0, duration: 0.2 }, 0);
    });
  },
  accessScanStart() {
    if (visual.phase === "accessScan") return;
    fingerprintSyncActive = false;
    interactionsLocked = true;
    visual.phase = "accessScan";
    play((timeline) => {
      moveCamera(
        timeline,
        accessTerminalCam,
        accessTerminalLook,
        0.72,
        "power2.out",
      );
      timeline.to(
        visual,
        {
          accessTerminal: 1,
          accessScan: 1,
          accessUnlock: 0,
          ringVelocity: 0.13,
          coreEnergy: 0.24,
          energyFlow: 0.2,
          innerGlow: 0.12,
          bloom: 0.38,
          pulse: 0.38,
          keyIntensity: 0.18,
          duration: 0.62,
          ease: "sine.out",
        },
        0,
      );
      timeline.to(
        visual,
        {
          accessScan: 0.48,
          energyFlow: 0.12,
          duration: 0.78,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        },
        0.62,
      );
    });
  },
  accessScanCancel() {
    if (visual.phase === "accessTerminal" && visual.accessScan < 0.01) return;
    interactionsLocked = true;
    visual.phase = "accessTerminal";
    play((timeline) => {
      moveCamera(
        timeline,
        accessTerminalCam,
        accessTerminalLook,
        0.65,
        "power2.out",
      );
      timeline.to(
        visual,
        {
          accessTerminal: 1,
          accessScan: 0,
          accessUnlock: accessSessionGranted ? 0.4 : 0,
          ringVelocity: 0.07,
          coreEnergy: 0.18,
          energyFlow: 0.06,
          innerGlow: 0.06,
          bloom: 0.3,
          pulse: 0.22,
          keyIntensity: 0.14,
          duration: 0.52,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(shake, { amp: 0, duration: 0.16 }, 0);
    });
  },
  accessGranted() {
    if (visual.phase === "accessGranted" || accessGrantPresented) return;
    accessSessionGranted = true;
    fingerprintSyncActive = false;
    interactionsLocked = true;
    visual.phase = "accessGranted";
    play(
      (timeline) => {
        timeline.to(
          visual,
          {
            accessTerminal: 1,
            accessScan: 0,
            accessUnlock: 1,
            ringVelocity: 0.34,
            coreEnergy: 0.46,
            energyFlow: 0.42,
            innerGlow: 0.28,
            bloom: 0.5,
            pulse: 0.58,
            keyIntensity: 0.26,
            duration: 0.34,
            ease: "power3.out",
          },
          0,
        );
        timeline.to(shake, { amp: 0.009, duration: 0.07 }, 0.12);
        timeline.to(shake, { amp: 0, duration: 0.2 }, 0.19);
        moveCamera(
          timeline,
          introOverviewCam,
          introOverviewLook,
          1.65,
          "power2.inOut",
          0.38,
        );
        timeline.to(
          visual,
          {
            accessTerminal: 0.3,
            accessUnlock: 0.45,
            leftEmphasis: 0,
            rightEmphasis: 0,
            ringVelocity: 0.12,
            coreEnergy: 0.32,
            energyFlow: 0.16,
            innerGlow: 0.18,
            bloom: 0.36,
            pulse: 0.34,
            keyIntensity: 0.2,
            duration: 1.2,
            ease: "sine.out",
          },
          0.72,
        );
      },
      () => {
        accessGrantPresented = true;
        interactionsLocked = false;
        visual.phase = "idle";
        visual.idleDrift = 0.24;
      },
    );
  },
  loadSubjects() {
    interactionsLocked = !accessSessionGranted;
    visual.phase = "loadSubjects";
    play((timeline) => {
      moveCamera(timeline, { x: 0.12, y: 2.62, z: 8.35 }, { x: 0, y: CORE_Y * 0.82, z: 0 }, 1.1);
      timeline.to(
        visual,
        {
          subjectPresence: 1,
          leftEmphasis: 0.62,
          rightEmphasis: 0.62,
          coreEnergy: 0.4,
          ringVelocity: 0.36,
          revealPower: 0,
          glyphOpacity: 0,
          analysis: 0,
          scanVisible: 0,
          scanOffset: 0,
          idleDrift: 0,
          lockAmount: 0.38,
          hatchOpen: 0.24,
          innerGlow: 0.86,
          vapor: 0.46,
          flicker: 0,
          residualScan: 0,
          energyFlow: 0.34,
          bloom: 0.5,
          chroma: 0.04,
          glitch: 0,
          blackout: 0,
          pulse: 0.44,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.95,
          ease: "power3.out",
        },
        0,
      );
      timeline.to(visual, { keyIntensity: 0.26, duration: 0.5 }, 0);
      timeline.to(shake, { amp: 0.008, duration: 0.12 }, 0.12);
      timeline.to(shake, { amp: 0, duration: 0.26 }, 0.24);
    });
  },
  startAnalysis() {
    fingerprintSyncActive = false;
    interactionsLocked = true;
    visual.phase = "analyze";
    visual.revealCode = null;
    play((timeline) => {
      moveCamera(
        timeline,
        { x: 0.16, y: 2.88, z: 9.5 },
        { x: 0, y: CORE_Y * 0.84, z: 0 },
        1.4,
        "power2.inOut",
        0,
      );
      timeline.to(
        visual,
        {
          lockAmount: 0.68,
          hatchOpen: 0.12,
          innerGlow: 0.9,
          vapor: 0.46,
          leftEmphasis: 0.82,
          rightEmphasis: 0.82,
          subjectPresence: Math.max(visual.subjectPresence, 0.92),
          analysis: 0.08,
          energyFlow: 0.04,
          ringVelocity: 0.2,
          coreEnergy: 0.32,
          bloom: 0.38,
          chroma: 0,
          glitch: 0,
          flicker: 0,
          residualScan: 0,
          revealPower: 0,
          glyphOpacity: 0,
          scanVisible: 0,
          scanOffset: 0,
          idleDrift: 0,
          blackout: 0,
          pulse: 0.36,
          keyIntensity: 0.2,
          leftFingerprint: 0,
          rightFingerprint: 0,
          leftFingerprintScan: 0,
          rightFingerprintScan: 0,
          leftFingerprintEnergy: 0,
          rightFingerprintEnergy: 0,
          fingerprintSync: 0,
          tintR: restColor.r,
          tintG: restColor.g,
          tintB: restColor.b,
          duration: 0.16,
          ease: "power2.out",
        },
        0,
      );
      timeline.to(
        visual,
        {
          lockAmount: 1,
          hatchOpen: 0,
          innerGlow: 1,
          leftEmphasis: 1,
          rightEmphasis: 1,
          duration: 0.24,
          ease: "power3.inOut",
        },
        0.18,
      );
      timeline.to(shake, { amp: 0.018, duration: 0.055, ease: "power3.out" }, 0.4);
      timeline.to(shake, { amp: 0, duration: 0.2, ease: "power2.out" }, 0.455);
      timeline.to(visual, { scanVisible: 1, analysis: 0.28, duration: 0.5, ease: "power1.out" }, 0.95);
      timeline.to(
        visual,
        {
          scanOffset: 1,
          duration: 1,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 5,
        },
        0.95,
      );
      timeline.to(
        visual,
        {
          energyFlow: 0.36,
          analysis: 0.4,
          coreEnergy: 0.38,
          bloom: 0.42,
          innerGlow: 1,
          duration: 0.5,
          ease: "power2.inOut",
        },
        2.2,
      );
      timeline.to(
        visual,
        {
          energyFlow: 0.96,
          analysis: 0.54,
          coreEnergy: 0.48,
          duration: 0.72,
          ease: "power2.in",
        },
        3,
      );
      timeline.to(visual, { ringVelocity: 0.72, duration: 0.72, ease: "power2.in" }, 3.6);
      timeline.to(visual, { ringVelocity: 1.65, analysis: 0.68, duration: 0.9, ease: "power3.in" }, 4.4);
      moveCamera(
        timeline,
        { x: 0.04, y: 2.14, z: 5.15 },
        { x: 0, y: CORE_Y * 0.98, z: 0 },
        2.5,
        "power3.inOut",
        4.2,
      );
      timeline.to(
        visual,
        {
          coreEnergy: 0.64,
          pulse: 0.7,
          bloom: 0.52,
          vapor: 0.58,
          keyIntensity: 0.27,
          duration: 0.62,
          ease: "power2.inOut",
        },
        4.3,
      );
      timeline.to(
        visual,
        {
          coreEnergy: 0.82,
          pulse: 0.92,
          bloom: 0.6,
          analysis: 0.84,
          energyFlow: 1,
          keyIntensity: 0.34,
          duration: 0.65,
          ease: "sine.in",
        },
        5.4,
      );
      timeline.to(
        visual,
        {
          coreEnergy: 0.94,
          pulse: 1.08,
          ringVelocity: 2.15,
          bloom: 0.64,
          analysis: 0.96,
          keyIntensity: 0.4,
          duration: 0.58,
          ease: "power2.in",
        },
        6.4,
      );
      timeline.to(visual, { flicker: 0.38, chroma: 0.08, duration: 0.12, ease: "power1.in" }, 7.25);
      timeline.to(shake, { amp: 0.014, duration: 0.1 }, 7.25);
      timeline.to(visual, { flicker: 0, chroma: 0, duration: 0.1 }, 7.37);
      timeline.to(
        visual,
        {
          blackout: 1,
          bloom: 0,
          scanVisible: 0,
          flicker: 0,
          chroma: 0,
          glitch: 0,
          duration: 0.06,
          ease: "none",
        },
        7.55,
      );
      timeline.to(
        visual,
        {
          blackout: 0.62,
          analysis: 1,
          scanVisible: 0,
          bloom: 0.16,
          coreEnergy: 0.3,
          energyFlow: 0.06,
          pulse: 0.24,
          keyIntensity: 0.1,
          ringVelocity: 0.16,
          flicker: 0,
          chroma: 0,
          glitch: 0,
          duration: 0.12,
          ease: "none",
        },
        7.8,
      );
      timeline.to(shake, { amp: 0, duration: 0.16 }, 7.61);
    });
  },
  revealResult(code: IncubatorRevealCode) {
    interactionsLocked = false;
    stopCurrentAnimation();
    visual.glyphOpacity = 0;
    visual.phase = "reveal";
    visual.revealCode = code;
    const tint = revealTint(code);
    const isZero = code === "0";
    const isOne = code === "1";
    const isM = code === "M";
    const cut = isM ? 0.22 : isOne ? 0.1 : 0.08;
    const impactAt = cut + 0.04;
    play((timeline) => {
      timeline.to(
        visual,
        {
          blackout: 1,
          bloom: 0.06,
          chroma: isM ? 0.55 : isOne ? 0.16 : 0.06,
          glitch: 0,
          flicker: isM ? 0.35 : 0,
          glyphOpacity: 0,
          scanVisible: 0,
          residualScan: 0,
          duration: Math.max(0.06, cut * 0.55),
          ease: "power2.in",
        },
        0,
      );
      timeline.to(visual, { blackout: 0, duration: isM ? 0.16 : 0.1, ease: "power4.out" }, impactAt);
      moveCamera(
        timeline,
        isM ? { x: 0.12, y: 1.98, z: 3.52 } : isOne ? { x: 0.02, y: 1.94, z: 3.72 } : { x: 0.04, y: 2.06, z: 3.92 },
        { x: 0, y: CORE_Y, z: 0 },
        isM ? 0.82 : 0.88,
        "power3.inOut",
      );
      timeline.to(
        visual,
        {
          analysis: isM ? 0.38 : isOne ? 0.2 : 0.04,
          ringVelocity: isM ? 2.85 : isOne ? 1.05 : 0.18,
          coreEnergy: isM ? 1.05 : isOne ? 0.82 : 0.38,
          revealPower: isM ? 1 : isOne ? 0.9 : 0.52,
          glyphOpacity: 1,
          leftEmphasis: isZero ? 0.18 : 0.5,
          rightEmphasis: isZero ? 0.18 : 0.5,
          energyFlow: isM ? 0.92 : isOne ? 0.4 : 0.06,
          lockAmount: 1,
          hatchOpen: 0,
          innerGlow: isM ? 0.95 : isOne ? 0.62 : 0.14,
          vapor: isM ? 0.7 : isOne ? 0.24 : 0.06,
          residualScan: isOne ? 1 : 0,
          scanVisible: isOne ? 0.62 : 0,
          idleDrift: 0,
          tintR: tint.r,
          tintG: tint.g,
          tintB: tint.b,
          bloom: isM ? 0.68 : isOne ? 0.62 : 0.34,
          chroma: isM ? 0.22 : isOne ? 0.1 : 0.02,
          glitch: 0,
          flicker: isM ? 0.12 : 0,
          pulse: isM ? 1.05 : isOne ? 0.72 : 0.22,
          keyIntensity: isM ? 0.42 : isOne ? 0.28 : 0.14,
          duration: isM ? 0.2 : 0.14,
          ease: "power3.out",
        },
        impactAt,
      );
      timeline.to(shake, { amp: isM ? 0.12 : isOne ? 0.04 : 0.012, duration: 0.08 }, impactAt);
      if (isM) {
        timeline.to(visual, { pulse: 1.12, chroma: 0.18, duration: 0.08 }, impactAt);
      }
      if (isZero) {
        timeline.to(
          visual,
          {
            revealPower: 0.3,
            keyIntensity: 0.1,
            bloom: 0.22,
            coreEnergy: 0.24,
            energyFlow: 0.02,
            innerGlow: 0.06,
            chroma: 0,
            glitch: 0,
            duration: 0.58,
            ease: "sine.out",
          },
          impactAt + 0.18,
        );
        timeline.to(shake, { amp: 0, duration: 0.32 }, impactAt + 0.16);
      } else if (isOne) {
        timeline.fromTo(
          visual,
          { scanOffset: 0 },
          { scanOffset: 1, duration: 0.46, ease: "power2.inOut" },
          impactAt + 0.08,
        );
        timeline.to(
          visual,
          {
            revealPower: 0.76,
            keyIntensity: 0.22,
            bloom: 0.58,
            chroma: 0.06,
            glitch: 0,
            flicker: 0,
            residualScan: 0,
            scanVisible: 0,
            duration: 0.52,
            ease: "sine.out",
          },
          impactAt + 0.22,
        );
        timeline.to(shake, { amp: 0, duration: 0.36 }, impactAt + 0.2);
      } else {
        timeline.to(
          visual,
          {
            chroma: 0.1,
            flicker: 0.04,
            bloom: 0.58,
            glitch: 0,
            duration: 0.5,
          },
          impactAt + 0.26,
        );
        timeline.to(visual, { revealPower: 0.9, keyIntensity: 0.36, coreEnergy: 0.92, duration: 0.7, ease: "sine.out" }, impactAt + 0.26);
        timeline.to(shake, { amp: 0, duration: 0.7, ease: "power2.out" }, impactAt + 0.26);
      }
    });
  },
  reset() {
    accessSessionGranted = false;
    accessGrantPresented = false;
    interactionsLocked = true;
    api.accessTerminalFocus();
  },
};

onMounted(() => {
  if (scene.value) {
    scene.value.fog = new FogExp2(0x000403, 0.018);
    scene.value.background = new Color("#000403");
  }
  emit("ready", api);
});

onUnmounted(() => {
  stopCurrentAnimation();
  shake.amp = 0;
});
</script>

<template>
  <TresPerspectiveCamera
    :position="cameraStart"
    :fov="32"
    :near="0.1"
    :far="120"
  />
  <TresAmbientLight :intensity="0.008 + 0.004 * visual.labPresence * (1 - visual.blackout) * lightMul.value" />
  <TresHemisphereLight
    color="#03261E"
    ground-color="#000000"
    :intensity="0.012 + 0.024 * visual.labPresence * (1 - visual.blackout)"
  />
  <TresDirectionalLight
    :position="keyLightPos"
    :intensity="visual.keyIntensity * visual.labPresence * (1 - visual.blackout) * lightMul.value"
    color="#8ABFA6"
    :cast-shadow="true"
  />
  <TresDirectionalLight
    :position="rimLightPos"
    :intensity="0.14 * visual.labPresence * (1 - visual.blackout)"
    color="#08995D"
  />
  <TresPointLight
    :position="fillPos"
    color="#04452E"
    :intensity="0.032 * visual.labPresence * (1 - visual.blackout)"
    :distance="5.4"
  />
  <TresSpotLight
    :position="leftSpotPos"
    :intensity="(0.14 + visual.leftEmphasis * 1.85) * visual.labPresence * (1 - visual.blackout) * lightMul.value"
    color="#0FB576"
    :angle="0.26"
    :penumbra="0.68"
    :distance="9"
  />
  <TresSpotLight
    :position="rightSpotPos"
    :intensity="(0.14 + visual.rightEmphasis * 1.85) * visual.labPresence * (1 - visual.blackout) * lightMul.value"
    color="#8ABFA6"
    :angle="0.26"
    :penumbra="0.68"
    :distance="9"
  />

  <ContactShadows
    :opacity="0.9 * visual.labPresence"
    :scale="22"
    :blur="2.8"
    :far="8"
    color="#000000"
  />

  <MorueVoid />
  <MorueGlyph />
  <LabAirlock @interact="forwardInteraction" />

  <TresGroup
    :scale="machineScale"
    :visible="visual.labPresence > 0.08"
  >
    <IncubatorMachine @interact="forwardInteraction" />
  </TresGroup>

  <CinematicComposer />
</template>
