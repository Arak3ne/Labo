<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import "./unknown-route.css";

const route = useRoute();
const path = computed(() => route.path || "/");
</script>

<template>
  <main
    class="unknown"
    lang="fr"
  >
    <div class="unknown__frame">
      <header class="unknown__header">
        <p
          class="unknown__brand"
          v-text="'M.O.R.U.E.'"
        />
        <span class="unknown__spacer" />
        <p
          class="unknown__status"
          v-text="'INTROUVABLE'"
        />
      </header>
      <div class="unknown__stage">
        <div class="unknown__copy">
          <h1 class="unknown__title">
            RESSOURCE INTROUVABLE
          </h1>
          <p class="unknown__subtitle">
            Chemin non reconnu
          </p>
          <dl class="unknown__meta">
            <div class="unknown__row">
              <dt>CHEMIN</dt>
              <dd>{{ path }}</dd>
            </div>
          </dl>
          <div class="unknown__prose">
            <p>Cette adresse n’appartient pas au système.</p>
          </div>
        </div>
        <footer class="unknown__foot">
          <p>Statut : INTROUVABLE</p>
        </footer>
      </div>
    </div>
  </main>
</template>
