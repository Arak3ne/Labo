<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from "vue";
import type { ChoiceId } from "./questions";
import { QUESTIONS } from "./questions";
import { getOrCreateSubjectId } from "./subjectId";
import "./d07.css";

type Phase = "intro" | "question" | "complete";

const TOTAL = QUESTIONS.length;
const HOLD_MS = 460;
const CTA_ARM_MS = 260;

const subjectId = getOrCreateSubjectId();
const phase = ref<Phase>("intro");
const questionIndex = ref(0);
const selected = ref<ChoiceId | null>(null);
const locked = ref(false);
const ctaBusy = ref(false);
const ctaArmed = ref(false);
const focusIndex = ref(0);
const columnMotion = ref<"swap" | "close">("swap");
const pointerIntent = ref(true);
const stageRef = ref<HTMLElement | null>(null);

let holdTimer = 0;
let ctaTimer = 0;

const question = computed(() => QUESTIONS[questionIndex.value]);
const progressCurrent = computed(() => String(questionIndex.value + 1).padStart(2, "0"));
const progressTotal = String(TOTAL).padStart(2, "0");
const paneKey = computed(() => {
  if (phase.value === "intro") return "intro";
  if (phase.value === "complete") return "complete";
  return `q-${questionIndex.value}`;
});
const motionName = computed(() => (columnMotion.value === "close" ? "d07-close" : "d07-swap"));

function startEvaluation(event: MouseEvent) {
  if (ctaBusy.value) return;
  pointerIntent.value = event.detail > 0;
  ctaBusy.value = true;
  ctaArmed.value = true;
  window.clearTimeout(ctaTimer);
  ctaTimer = window.setTimeout(() => {
    columnMotion.value = "swap";
    phase.value = "question";
    questionIndex.value = 0;
    selected.value = null;
    locked.value = false;
    focusIndex.value = 0;
  }, CTA_ARM_MS);
}

function selectChoice(id: ChoiceId, index: number, fromPointer: boolean) {
  if (locked.value || phase.value !== "question") return;
  pointerIntent.value = fromPointer;
  selected.value = id;
  focusIndex.value = index;
  locked.value = true;
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(advance, HOLD_MS);
}

function onChoiceClick(id: ChoiceId, index: number, event: MouseEvent) {
  selectChoice(id, index, event.detail > 0);
}

function advance() {
  if (questionIndex.value >= TOTAL - 1) {
    columnMotion.value = "close";
    phase.value = "complete";
    return;
  }
  columnMotion.value = "swap";
  questionIndex.value += 1;
  selected.value = null;
  locked.value = false;
  focusIndex.value = 0;
}

function onChoiceKeydown(event: KeyboardEvent) {
  if (locked.value || phase.value !== "question") return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    void moveFocus(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    void moveFocus(-1);
    return;
  }
}

async function moveFocus(delta: number) {
  const last = (question.value?.choices.length ?? 1) - 1;
  let next = focusIndex.value + delta;
  if (next < 0) next = last;
  if (next > last) next = 0;
  focusIndex.value = next;
  await nextTick();
  const radios = stageRef.value?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[next]?.focus();
}

async function onPaneEnter(el: Element) {
  if (phase.value !== "question") return;
  await nextTick();
  if (pointerIntent.value) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && (el as HTMLElement).contains(active)) {
      active.blur();
    }
    return;
  }
  const first = (el as HTMLElement).querySelector<HTMLElement>('[role="radio"]');
  first?.focus({ preventScroll: true });
}

onUnmounted(() => {
  window.clearTimeout(holdTimer);
  window.clearTimeout(ctaTimer);
});
</script>

<template>
  <main
    class="d07"
    lang="fr"
  >
    <div class="d07__frame">
      <header class="d07__header">
        <p
          class="d07__brand"
          v-text="'M.O.R.U.E.'"
        />
        <p class="d07__subject">
          <span class="d07-k">SUJET</span>
          <span class="d07-v">{{ subjectId }}</span>
        </p>
        <div class="d07__spacer">
          <p
            v-if="phase === 'question'"
            class="d07-progress"
            aria-live="polite"
            :aria-label="`${progressCurrent} sur ${progressTotal}`"
          >
            <span class="d07-progress__n">{{ progressCurrent }}</span><span class="d07-progress__rest">{{ `  /  ${progressTotal}` }}</span>
          </p>
        </div>
        <p
          class="d07__terminal"
          v-text="'TERMINAL  D-07'"
        />
      </header>

      <div
        ref="stageRef"
        class="d07__stage"
      >
        <Transition
          :name="motionName"
          appear
          mode="out-in"
          @enter="onPaneEnter"
        >
          <div
            :key="paneKey"
            class="d07__pane"
            :class="`d07__pane--${phase}`"
          >
            <div
              v-if="phase === 'intro'"
              class="d07__copy"
            >
              <div class="d07-intro-text">
                <h1 class="d07-title">
                  PROTOCOLE DE PRÉ-INTÉGRATION
                </h1>
                <p class="d07-subtitle">
                  Évaluation de profil expérimental
                </p>
                <dl class="d07-meta">
                  <div class="d07-meta__row">
                    <dt>SUJET</dt>
                    <dd>{{ subjectId }}</dd>
                  </div>
                  <div class="d07-meta__row">
                    <dt>TERMINAL</dt>
                    <dd>D-07</dd>
                  </div>
                  <div class="d07-meta__row">
                    <dt>DURÉE</dt>
                    <dd>5 MIN</dd>
                  </div>
                </dl>
                <div class="d07-prose">
                  <p>
                    Cette procédure d’admission établit votre profil expérimental
                    en vue de l’intégration.
                  </p>
                  <p>
                    Aucune préparation n’est requise.
                    Durée estimée : cinq minutes.
                  </p>
                </div>
              </div>
              <button
                class="d07-cta"
                :class="{ 'd07-cta--armed': ctaArmed }"
                type="button"
                :disabled="ctaBusy"
                @click="startEvaluation"
              >
                <span
                  class="d07-cta__tick"
                  aria-hidden="true"
                />
                <span class="d07-cta__label">COMMENCER L’ÉVALUATION</span>
              </button>
            </div>

            <footer
              v-if="phase === 'intro'"
              class="d07__foot"
            >
              <p class="d07-status d07-status--wide">
                <span v-text="'PROCÉDURE  PRÉ-INTÉGRATION'" />
                <span v-text="'STATUT  EN ATTENTE'" />
              </p>
              <p
                class="d07-status d07-status--narrow"
                v-text="'STATUT  EN ATTENTE'"
              />
            </footer>

            <template v-else-if="phase === 'question' && question">
              <div class="d07__copy">
                <h1
                  :id="`d07-q-${question.id}`"
                  class="d07-question"
                >
                  {{ question.prompt }}
                </h1>
                <div
                  class="d07-choices"
                  role="radiogroup"
                  :aria-labelledby="`d07-q-${question.id}`"
                  @keydown="onChoiceKeydown"
                >
                  <button
                    v-for="(choice, index) in question.choices"
                    :key="choice.id"
                    class="d07-choice"
                    :class="{
                      'd07-choice--selected': selected === choice.id,
                      'd07-choice--locked': locked,
                      'd07-choice--dim': locked && selected !== choice.id,
                    }"
                    type="button"
                    role="radio"
                    :aria-checked="selected === choice.id"
                    :aria-disabled="locked"
                    :tabindex="locked ? -1 : focusIndex === index ? 0 : -1"
                    @click="onChoiceClick(choice.id, index, $event)"
                  >
                    <span
                      class="d07-choice__rail"
                      aria-hidden="true"
                    />
                    <span class="d07-choice__index">{{ choice.id }}</span>
                    <span class="d07-choice__label">{{ choice.label }}</span>
                    <span
                      class="d07-choice__ink"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </template>

            <template v-else-if="phase === 'complete'">
              <div class="d07__copy">
                <h1 class="d07-title">
                  PROFIL ENREGISTRÉ
                </h1>
                <p class="d07-subtitle">
                  Pré-intégration validée
                </p>
                <div class="d07-prose">
                  <p>
                    Les réponses ont été transmises à M.O.R.U.E.
                    Le dossier du sujet est à jour.
                  </p>
                  <p>Vous pouvez fermer cette page.</p>
                </div>
              </div>
              <footer class="d07__foot">
                <div class="d07-log">
                  <p>Origine : D-07</p>
                  <p>Transmission : OK</p>
                  <p>Relais secondaire : D-14</p>
                </div>
              </footer>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </main>
</template>
