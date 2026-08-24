<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { IncubatorScreenAnchors } from "../scene/sceneEvents";
import type {
  IncubatorChamber,
  IncubatorFingerprintOccupant,
  IncubatorPersonalProjection,
  IncubatorRoomSnapshot,
} from "../types";
import type {
  IncubatorActorPreview,
  IncubatorHistoryEntry,
  IncubatorUiPhase,
} from "./incubatorUiTypes";
import { chamberSubjectId } from "./chamberSubjectId";
import type { IncubatorAccessMode } from "./useIncubatorConsole";

const props = defineProps<{
  operator: IncubatorActorPreview;
  projection: IncubatorPersonalProjection | undefined;
  history: IncubatorHistoryEntry[];
  snapshot: IncubatorRoomSnapshot | undefined;
  activeChamber: IncubatorChamber | null;
  localHeldChamber: IncubatorChamber | null;
  ownChamber: IncubatorChamber | null;
  phase: IncubatorUiPhase;
  error: string | null;
  lastCode: "0" | "1" | "M" | null;
  syncProgress: number;
  syncRemainingMs: number;
  historyOpen: boolean;
  sessionLoading: boolean;
  accessCode: string;
  generatedSessionCode: string | null;
  accessMode: IncubatorAccessMode;
  anchors: IncubatorScreenAnchors;
  hoveredChamber: IncubatorChamber | null;
  crossingThreshold: boolean;
  airlockReady: boolean;
}>();

const emit = defineEmits<{
  chamber: [side: IncubatorChamber];
  press: [side: IncubatorChamber];
  release: [];
  close: [];
  history: [];
  reset: [];
  skip: [];
  openTerminal: [];
  accessCode: [value: string];
  accessSubmit: [];
  accessMode: [mode: Exclude<IncubatorAccessMode, null>];
  accessBack: [];
}>();

const root = ref<HTMLElement | null>(null);
const accessInput = ref<HTMLInputElement | null>(null);
const viewport = ref({
  width: typeof window === "undefined" ? 1280 : window.innerWidth,
  height: typeof window === "undefined" ? 720 : window.innerHeight,
});
const introActive = computed(() =>
  ["boot", "identification", "intro_transition"].includes(props.phase),
);
const activeOccupant = computed(() =>
  props.activeChamber ? occupant(props.activeChamber) : null,
);
const canApply = computed(() =>
  Boolean(
    props.activeChamber &&
    (!activeOccupant.value || activeOccupant.value.subjectId === props.operator.id) &&
    (!props.ownChamber || props.ownChamber === props.activeChamber),
  ),
);
const syncCountdown = computed(() => (Math.max(0, props.syncRemainingMs) / 1000).toFixed(1));
const syncReleaseReady = computed(() =>
  (props.phase === "syncing" && props.syncRemainingMs <= 0)
  || (props.phase === "analyze" && Boolean(props.localHeldChamber)),
);
const holdPrompt = computed(() => {
  if (props.phase === "analyze" && props.localHeldChamber) return "RELÂCHER LE CONTACT";
  if (props.phase === "syncing" && props.syncRemainingMs <= 0) return "RELÂCHER";
  if (props.phase === "syncing") return "MAINTENIR LE CONTACT";
  if (activeOccupant.value?.pressed) return "EMPREINTE DÉTECTÉE";
  return "CAPTEUR EN ATTENTE";
});
const introClock = ref(0);
const introTick = ref(0);
let introClockTimer = 0;
const introStatus = computed(() => {
  if (props.phase === "boot") return "INITIALISATION DU SYSTÈME";
  if (props.phase === "identification") return "IDENTIFICATION OPÉRATEUR";
  return "AUTORISATION VALIDÉE";
});
const introProtocol = computed(() => [
  ["PROTOCOLE", "COMPARAISON SIGNATURE"],
  ["CHAMBRES", "02 COBAYES"],
  ["COMPARATEUR", "SCELLÉ / SERVEUR"],
  ["LIAISON", "CHIFFRÉE"],
  ["ACCÈS", `${props.projection?.access.remaining ?? "—"} RESTANTS`],
]);
const introScience = computed(() => {
  const seconds = introClock.value;
  const scan = (48 + Math.sin(seconds * 1.7) * 0.12).toFixed(3);
  const fidelity = (98.6 + Math.sin(seconds * 0.9) * 0.35).toFixed(2);
  const ambient = (18.2 + Math.sin(seconds * 0.35) * 0.16).toFixed(2);
  const pressure = (101.28 + Math.sin(seconds * 0.22) * 0.05).toFixed(2);
  return [
    ["T.AMBIANTE", `${ambient} °C`],
    ["P.SAS", `${pressure} kPa`],
    ["HORLOGE", formatIntroClock(seconds)],
    ["SCAN OPTIQUE", `${scan} kHz`],
    ["FID. HOLO", `${fidelity} %`],
    ["CORE", props.phase === "boot" ? "BOOT" : "ONLINE"],
    ["BUFFER", "SCELLÉ"],
  ];
});
const introLog = computed(() => {
  const lines = [
    "KERNEL MORUE · SÉQUENCE DE RÉVEIL",
    "CHARGE MODULE BIOMÉTRIQUE v4.18",
    "BUS OPTIQUE 380–780 nm · STABLE",
    "VERROU SIGNATURE · CÔTÉ SERVEUR",
    "CHAMBRES 02 · COMPARATEUR INACTIF",
    "SORTIE PUBLIQUE LIMITÉE À 0 / 1 / M",
  ];
  if (props.phase !== "boot") {
    lines.push(
      `OPÉRATEUR ${props.projection?.player.id ?? "—"} · IDENTIFIÉ`,
      "SESSION PERSONNELLE CHARGÉE",
      "AUTORISATION D’APPROCHE DU SAS",
    );
  }
  const visible = 3 + Math.min(lines.length - 3, introTick.value);
  return lines.slice(0, visible);
});

function formatIntroClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds * 10));
  const tenths = total % 10;
  const whole = Math.floor(total / 10);
  const mins = String(Math.floor(whole / 60)).padStart(2, "0");
  const secs = String(whole % 60).padStart(2, "0");
  return `${mins}:${secs}.${tenths}`;
}
const accessErrorMessage = computed(() => {
  if (props.error === "rate_limited") {
    return "TROP DE TENTATIVES · RÉESSAYEZ PLUS TARD";
  }
  if (props.error === "same_identity") {
    return "SECOND SUJET REQUIS · UTILISEZ UNE SESSION NAVIGATEUR DISTINCTE";
  }
  if (props.error === "unauthorized" || props.error === "not_authenticated") {
    return "SESSION D’IDENTIFICATION EXPIRÉE · RECONNECTEZ-VOUS";
  }
  if (props.error === "network_error") {
    return "LIAISON AU LABORATOIRE INTERROMPUE";
  }
  if (props.error === "request_failed") {
    return "RÉPONSE DU LABORATOIRE INVALIDE";
  }
  return "CODE NON RECONNU OU INDISPONIBLE";
});

function enterLab() {
  if (props.crossingThreshold || !props.airlockReady || props.phase !== "intro_transition") return;
  emit("skip");
}

function occupant(side: IncubatorChamber): Readonly<IncubatorFingerprintOccupant> | null {
  return props.snapshot?.chambers[side] ?? null;
}

function chamberSubject(side: IncubatorChamber) {
  return chamberSubjectId(props.snapshot, side);
}

function anchorStyle(anchor: { x: number; y: number }, margin = 72) {
  return {
    left: `${Math.min(viewport.value.width - margin, Math.max(margin, anchor.x))}px`,
    top: `${Math.min(viewport.value.height - 56, Math.max(56, anchor.y))}px`,
  };
}

function hudStyle(anchor: { x: number; y: number }) {
  const margin = Math.min(190, viewport.value.width * 0.32);
  return anchorStyle({
    x: Math.min(viewport.value.width - margin, Math.max(margin, anchor.x)),
    y: anchor.y,
  }, margin);
}

function formatStamp(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function beginPointer(event: PointerEvent, side: IncubatorChamber) {
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  emit("press", side);
}

function endPointer(event: PointerEvent) {
  event.preventDefault();
  emit("release");
}

function beginKey(event: KeyboardEvent, side: IncubatorChamber) {
  if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
  event.preventDefault();
  emit("press", side);
}

function endKey(event: KeyboardEvent) {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  emit("release");
}

function updateViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
}

watch(
  () => props.activeChamber,
  async (side) => {
    if (!side) return;
    await nextTick();
    (root.value?.querySelector("[data-fingerprint-hold]") as HTMLElement | null)?.focus();
  },
);
watch(
  () => props.accessMode,
  async (mode) => {
    if (!mode) return;
    await nextTick();
    accessInput.value?.focus();
  },
);

function stopIntroClock() {
  if (introClockTimer) window.clearInterval(introClockTimer);
  introClockTimer = 0;
}

function startIntroClock() {
  if (introClockTimer) return;
  const origin = performance.now();
  introClock.value = 0;
  introTick.value = 0;
  introClockTimer = window.setInterval(() => {
    introClock.value = (performance.now() - origin) / 1000;
    introTick.value += 1;
  }, 220);
}

watch(introActive, (active) => {
  if (active) startIntroClock();
  else stopIntroClock();
}, { immediate: true });

onMounted(async () => {
  window.addEventListener("resize", updateViewport);
  await nextTick();
  if (introActive.value) {
    (root.value?.querySelector("[data-intro-skip]") as HTMLElement | null)?.focus();
  }
});
onUnmounted(() => {
  window.removeEventListener("resize", updateViewport);
  stopIntroClock();
});
</script>

<template>
  <div
    ref="root"
    class="incubator-spatial"
    :data-phase="phase"
    @click="emit('close')"
  >
    <div class="incubator-spatial__scene">
      <slot />
    </div>

    <section
      v-if="introActive"
      class="incubator-intro"
      :data-intro-phase="phase"
      aria-label="Introduction de l’Incubateur"
    >
      <button
        v-if="phase === 'intro_transition' && airlockReady && !crossingThreshold"
        type="button"
        class="incubator-airlock-prompt incubator-airlock-prompt--sas"
        data-intro-skip
        aria-label="Franchir le sas et entrer dans le laboratoire"
        @click.stop="enterLab"
      >
        <span>SAS · SEUIL D’ACCÈS</span>
        <strong>FRANCHIR</strong>
      </button>
      <div
        v-if="phase !== 'intro_transition'"
        class="incubator-intro__telemetry"
        role="status"
        aria-live="polite"
      >
        <p>LAB / M.O.R.U.E.</p>
        <span>{{ introStatus }}</span>
        <strong v-if="phase !== 'boot' && projection">
          {{ projection.player.displayName }}
        </strong>
        <dl>
          <div
            v-for="row in introProtocol"
            :key="row[0]"
          >
            <dt>{{ row[0] }}</dt>
            <dd>{{ row[1] }}</dd>
          </div>
        </dl>
      </div>
      <aside
        v-if="phase !== 'intro_transition'"
        class="incubator-intro__science"
        aria-hidden="true"
      >
        <p>TÉLÉMÉTRIE LABORATOIRE</p>
        <dl>
          <div
            v-for="row in introScience"
            :key="row[0]"
          >
            <dt>{{ row[0] }}</dt>
            <dd>{{ row[1] }}</dd>
          </div>
        </dl>
      </aside>
      <ol
        v-if="phase !== 'intro_transition'"
        class="incubator-intro__log"
        aria-hidden="true"
      >
        <li
          v-for="line in introLog"
          :key="line"
        >
          {{ line }}
        </li>
      </ol>
    </section>

    <template v-else>
      <header
        v-if="phase !== 'analyze'"
        class="incubator-system-mark"
      >
        <span>LAB / INCUBATEUR · MODULE BIOMÉTRIQUE</span>
        <span>{{ snapshot?.accessCode ?? "CONNEXION" }} · {{ snapshot?.state ?? "WAITING" }}</span>
      </header>

      <button
        v-if="phase === 'inside'"
        type="button"
        class="incubator-airlock-prompt incubator-airlock-prompt--terminal"
        :style="anchorStyle(anchors.terminal, 160)"
        aria-label="Approcher le terminal d’accès"
        @click.stop="emit('openTerminal')"
      >
        <span>TERMINAL D’ACCÈS</span>
        <strong>APPROCHER</strong>
      </button>

      <section
        v-if="phase === 'access_terminal' || phase === 'access_granted' || phase === 'waiting_participant'"
        class="incubator-access-terminal"
        :class="{ 'is-granted': phase === 'access_granted' }"
        :style="hudStyle(anchors.terminal)"
        aria-label="Sas d’accès biométrique"
        @click.stop
      >
        <p class="incubator-kicker">
          SAS / TERMINAL D’ACCÈS
        </p>
        <strong>
          {{
            phase === "access_granted"
              ? "ACCÈS VALIDÉ"
              : phase === "waiting_participant"
                ? "EN ATTENTE DU SECOND SUJET"
                : "CANAL D’INCUBATION"
          }}
        </strong>
        <div
          v-if="phase === 'access_terminal' && !accessMode"
          class="incubator-access-choices"
        >
          <button
            type="button"
            :disabled="sessionLoading"
            @click="emit('accessMode', 'initiate')"
          >
            INITIER UNE INCUBATION
          </button>
          <button
            type="button"
            :disabled="sessionLoading"
            @click="emit('accessMode', 'join')"
          >
            REJOINDRE UNE INCUBATION
          </button>
        </div>
        <label
          v-if="phase === 'access_terminal' && accessMode"
          class="incubator-access-code"
        >
          <span>{{ accessMode === "initiate" ? "CODE D’AUTORISATION" : "CODE DE SESSION" }}</span>
          <input
            ref="accessInput"
            :value="accessCode"
            type="text"
            inputmode="text"
            autocomplete="off"
            spellcheck="false"
            :aria-label="accessMode === 'initiate' ? 'Code d’autorisation' : 'Code de session'"
            maxlength="5"
            :disabled="sessionLoading"
            @input="emit('accessCode', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="emit('accessSubmit')"
          >
        </label>
        <p
          v-if="phase === 'access_terminal' && accessMode"
          class="incubator-access-hint"
        >
          {{
            accessMode === "initiate"
              ? "CE CODE SERA RÉSERVÉ ET PARTAGÉ AVEC LE SECOND SUJET"
              : "VALIDATION AUTOMATIQUE · ENTRÉE POUR TRANSMETTRE"
          }}
        </p>
        <button
          v-if="phase === 'access_terminal' && accessMode"
          type="button"
          class="incubator-access-back"
          :disabled="sessionLoading"
          @click="emit('accessBack')"
        >
          ← RETOUR
        </button>
        <p
          v-if="generatedSessionCode"
          class="incubator-generated-code"
        >
          <span>CODE D’ACCÈS</span>
          <strong>{{ generatedSessionCode }}</strong>
        </p>
        <p
          v-if="error"
          class="incubator-terminal-error"
          role="alert"
        >
          {{ accessErrorMessage }}
        </p>
      </section>

      <template v-else-if="phase !== 'analyze' || localHeldChamber">
        <template v-if="phase !== 'analyze'">
          <button
            v-for="side in (['left', 'right'] as const)"
            :key="side"
            type="button"
            class="incubator-anchor-label"
            :class="{
              'is-hovered': hoveredChamber === side,
              'is-loaded': chamberSubject(side),
              'is-pressed': occupant(side)?.pressed,
            }"
            :style="anchorStyle(anchors[side])"
            :data-chamber="side"
            :aria-label="`Cuve ${side === 'left' ? 'A' : 'B'} — ${
              chamberSubject(side) ? `occupée par ${chamberSubject(side)}` : 'vide'
            }`"
            @click.stop="emit('chamber', side)"
          >
            <span class="incubator-anchor-label__side">CUVE {{ side === "left" ? "A" : "B" }}</span>
            <strong v-if="chamberSubject(side)">{{ chamberSubject(side) }}</strong>
            <span v-else>VIDE · DISPONIBLE</span>
            <small v-if="occupant(side)?.pressed">EMPREINTE DÉTECTÉE</small>
            <small v-else-if="occupant(side)">CONTACT INTERROMPU</small>
          </button>
        </template>

        <section
          v-if="activeChamber"
          class="incubator-float-panel incubator-fingerprint-hud"
          :class="{ 'is-release': syncReleaseReady }"
          :style="hudStyle(anchors[activeChamber])"
          role="dialog"
          :aria-label="`Capteur biométrique cuve ${activeChamber === 'left' ? 'A' : 'B'}`"
          @click.stop
        >
          <button
            v-if="phase !== 'analyze'"
            class="incubator-panel-close"
            type="button"
            aria-label="Fermer le capteur biométrique"
            @click="emit('close')"
          >
            ×
          </button>
          <p class="incubator-kicker">
            CAPTEUR / CUVE {{ activeChamber === "left" ? "A" : "B" }}
          </p>
          <span class="incubator-fingerprint-identity">
            SESSION AUTHENTIFIÉE · {{ operator.id }}
          </span>

          <button
            v-if="canApply"
            type="button"
            class="incubator-fingerprint-ring incubator-fingerprint-surface"
            :class="{
              'is-scanning': localHeldChamber === activeChamber,
              'is-detected': activeOccupant?.pressed,
              'is-syncing': phase === 'syncing',
            }"
            :style="phase === 'syncing' ? { '--sync': syncProgress } : undefined"
            data-fingerprint-hold
            :aria-pressed="localHeldChamber === activeChamber"
            :aria-label="holdPrompt"
            @click.prevent
            @pointerdown="beginPointer($event, activeChamber)"
            @pointerup="endPointer"
            @pointercancel="endPointer"
            @lostpointercapture="endPointer"
            @keydown="beginKey($event, activeChamber)"
            @keyup="endKey"
          >
            <span />
            <b
              v-if="phase === 'syncing'"
              class="incubator-sync-countdown"
              data-sync-countdown
            >{{ syncCountdown }}</b>
          </button>
          <div
            v-else
            class="incubator-fingerprint-ring"
            :class="{ 'is-detected': activeOccupant?.pressed }"
            aria-hidden="true"
          >
            <span />
          </div>

          <template v-if="activeOccupant && activeOccupant.subjectId !== operator.id">
            <strong>CUVE OCCUPÉE</strong>
            <span>{{ activeOccupant.subjectId }}</span>
            <small>{{ activeOccupant.pressed ? "EMPREINTE DÉTECTÉE" : "CONTACT INTERROMPU" }}</small>
          </template>
          <template v-else>
            <strong>{{ holdPrompt }}</strong>
            <span v-if="phase === 'syncing' && !syncReleaseReady">JUSQU’À L’ANALYSE</span>
            <span v-else-if="phase === 'analyze' && localHeldChamber">ANALYSE EN COURS</span>
            <span v-else-if="syncReleaseReady">LÂCHEZ LES CONTACTS</span>
            <span v-else-if="activeOccupant?.pressed">EN ATTENTE DE LA SECONDE EMPREINTE</span>
          </template>
        </section>

        <section
          v-if="phase === 'syncing'"
          class="incubator-fingerprint-sync"
          :style="anchorStyle(anchors.core)"
          role="status"
          aria-live="polite"
        >
          <div
            class="incubator-fingerprint-ring is-syncing"
            :style="{ '--sync': syncProgress }"
          >
            <span />
            <b
              class="incubator-sync-countdown"
              data-sync-countdown
            >{{ syncCountdown }}</b>
          </div>
          <strong>{{ syncReleaseReady ? "RELÂCHER" : "SYNCHRONISATION" }}</strong>
          <small>{{
            syncReleaseReady
              ? "LÂCHEZ LES DEUX CONTACTS"
              : "MAINTENIR LE DOUBLE CONTACT"
          }}</small>
        </section>

        <section
          v-if="phase === 'reveal' && lastCode"
          class="incubator-result"
          :style="anchorStyle(anchors.core)"
          data-reveal-code
        >
          <button
            type="button"
            class="incubator-result-reset"
            aria-label="Ouvrir une nouvelle session"
            data-action="new-run"
            @click.stop="emit('reset')"
          >
            ↻
          </button>
        </section>

        <section
          v-if="phase === 'cancelled'"
          class="incubator-cancelled"
          :style="anchorStyle(anchors.core)"
          role="status"
        >
          <strong>
            {{
              error === "session_interrupted"
                ? "SESSION INTERROMPUE · CRÉEZ OU REJOIGNEZ UNE NOUVELLE SESSION"
                : "SESSION BIOMÉTRIQUE ANNULÉE"
            }}
          </strong>
          <button
            type="button"
            aria-label="Ouvrir une nouvelle session"
            @click.stop="emit('reset')"
          >
            ↻
          </button>
        </section>

        <button
          v-if="!historyOpen"
          type="button"
          class="incubator-terminal-trigger"
          :style="anchorStyle(anchors.terminal)"
          data-history-trigger
          @click.stop="emit('history')"
        >
          <span>HISTORIQUE / {{ history.length }}</span>
          <small v-if="generatedSessionCode">
            CANAL · {{ generatedSessionCode }}
          </small>
        </button>

        <section
          v-if="historyOpen"
          class="incubator-float-panel incubator-history"
          :style="hudStyle(anchors.terminal)"
          data-incubator-history
          role="dialog"
          aria-label="Historique des incubations"
          @click.stop
        >
          <button
            class="incubator-panel-close"
            type="button"
            @click="emit('close')"
          >
            ×
            <span class="incubator-sr-only">Fermer l’historique</span>
          </button>
          <p class="incubator-kicker">
            TERMINAL / HISTORIQUE
          </p>
          <p v-if="history.length === 0">
            Aucun run historisé
          </p>
          <article
            v-for="entry in history"
            :key="entry.id"
          >
            <strong>{{ entry.code }}</strong>
            <span>{{ entry.subjectIds.join(" / ") }}</span>
            <small>{{ formatStamp(entry.at) }} · {{ entry.actor.id }}</small>
          </article>
        </section>

        <p
          v-if="sessionLoading"
          class="incubator-access-context"
          role="status"
        >
          OUVERTURE DU CANAL BIOMÉTRIQUE
        </p>
        <p
          v-else-if="projection"
          class="incubator-access-context"
          data-access-counter
        >
          ACCÈS · {{ projection.access.used }} CONSOMMÉ ·
          {{ projection.access.remaining }} RESTANT
        </p>
        <p
          v-if="error && error !== 'session_interrupted'"
          class="incubator-error"
          data-error
          role="alert"
        >
          OPÉRATION REFUSÉE · {{ error.replaceAll("_", " ").toUpperCase() }}
        </p>
      </template>

      <p
        v-if="phase === 'analyze'"
        class="incubator-analysis-status"
        role="status"
        aria-live="polite"
      >
        <strong>{{ localHeldChamber ? "RELÂCHER LE CONTACT" : "DOUBLE EMPREINTE CONFIRMÉE" }}</strong>
        <span>ANALYSE EN COURS</span>
      </p>
    </template>
  </div>
</template>
