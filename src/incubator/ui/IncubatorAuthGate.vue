<script setup lang="ts">
import { computed, onMounted, provide, ref } from "vue";
import { getMorueVoice, unlockMorueAudio } from "../audio";
import { createServerAuthClient, IncubatorTransportError } from "../core/serverFingerprintClient";
import { createIncubatorAuthController, incubatorAuthKey } from "./incubatorAuth";
import "./incubator-console.css";

const playerCode = ref("");
const submitting = ref(false);
const voice = getMorueVoice();
const auth = createIncubatorAuthController(
  createServerAuthClient(),
  (error) => error instanceof IncubatorTransportError ? error.code : undefined,
  voice,
);
const message = computed(() => {
  if (auth.error.value === "rate_limited") return "TROP DE TENTATIVES · PATIENTEZ AVANT UN NOUVEL ESSAI";
  if (auth.error.value === "invalid_credentials") return "IDENTIFIANTS NON RECONNUS";
  if (auth.error.value === "unavailable") return "LIAISON AU LABORATOIRE INDISPONIBLE";
  return null;
});

provide(incubatorAuthKey, {
  projection: computed(() => auth.projection.value!),
  logout: auth.logout,
});

async function submit() {
  const normalizedPlayerCode = playerCode.value.trim().toUpperCase();
  if (submitting.value || !normalizedPlayerCode) return;
  submitting.value = true;
  void unlockMorueAudio();
  try {
    await auth.login(normalizedPlayerCode);
  } finally {
    submitting.value = false;
  }
}

onMounted(auth.check);
</script>

<template>
  <slot v-if="auth.status.value === 'authenticated'" />

  <main
    v-else
    class="incubator-page incubator-auth"
  >
    <div class="incubator-auth__grid" />
    <section
      v-if="auth.status.value === 'checking'"
      class="incubator-auth__panel"
      role="status"
      aria-live="polite"
    >
      <p>LAB / CONTRÔLE D’ACCÈS</p>
      <strong>VÉRIFICATION DE SESSION</strong>
      <span class="incubator-auth__pulse" />
    </section>

    <section
      v-else-if="auth.status.value === 'unavailable'"
      class="incubator-auth__panel"
      role="alert"
    >
      <p>LAB / CONTRÔLE D’ACCÈS</p>
      <strong>LIAISON INTERROMPUE</strong>
      <span>{{ message }}</span>
      <button
        type="button"
        @click="auth.check"
      >
        RÉESSAYER
      </button>
    </section>

    <form
      v-else
      class="incubator-auth__panel"
      aria-label="Identification au Laboratoire"
      @submit.prevent="submit"
    >
      <p>LAB / CONTRÔLE D’ACCÈS</p>
      <strong>IDENTIFICATION SUJET</strong>
      <label>
        <span>CODE JOUEUR</span>
        <input
          v-model.trim="playerCode"
          name="username"
          type="text"
          autocomplete="username"
          autocapitalize="characters"
          spellcheck="false"
          required
        >
      </label>
      <p
        v-if="message"
        class="incubator-auth__error"
        role="alert"
      >
        {{ message }}
      </p>
      <button
        type="submit"
        :disabled="submitting"
      >
        {{ submitting ? "IDENTIFICATION EN COURS" : "OUVRIR LE SAS" }}
      </button>
    </form>
  </main>
</template>
