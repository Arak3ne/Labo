<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

const NODES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

const props = withDefaults(
  defineProps<{
    ariaDescribedby?: string;
    disabled?: boolean;
    status?: "idle" | "fail" | "ok";
  }>(),
  {
    ariaDescribedby: undefined,
    disabled: false,
    status: "idle",
  },
);

const emit = defineEmits<{
  submit: [path: number[]];
}>();

const rootRef = ref<HTMLElement | null>(null);
const path = ref<number[]>([]);
const drawing = ref(false);
const pointer = ref<{ x: number; y: number } | null>(null);
const centers = ref<{ x: number; y: number }[]>([]);

let pointerId: number | null = null;

const linePoints = computed(() => {
  const pts = path.value
    .map((index) => centers.value[index])
    .filter((point): point is { x: number; y: number } => Boolean(point))
    .map((point) => `${point.x},${point.y}`);
  if (drawing.value && pointer.value && pts.length > 0) {
    pts.push(`${pointer.value.x},${pointer.value.y}`);
  }
  return pts.join(" ");
});

const tone = computed(() => {
  if (props.status === "fail" || props.status === "ok") return props.status;
  return drawing.value ? "drawing" : "idle";
});

watch(
  () => props.status,
  (status) => {
    if (status === "fail") {
      drawing.value = false;
      pointer.value = null;
    }
    if (status === "idle") {
      path.value = [];
      drawing.value = false;
      pointer.value = null;
    }
  },
);

function measureCenters(): void {
  const root = rootRef.value;
  if (!root) return;
  const rootBox = root.getBoundingClientRect();
  const hits = root.querySelectorAll<HTMLElement>("[data-node]");
  centers.value = Array.from(hits).map((hit) => {
    const box = hit.getBoundingClientRect();
    return {
      x: box.left - rootBox.left + box.width / 2,
      y: box.top - rootBox.top + box.height / 2,
    };
  });
}

function localPoint(event: PointerEvent): { x: number; y: number } {
  const root = rootRef.value;
  if (!root) return { x: 0, y: 0 };
  const box = root.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function nodeAt(event: PointerEvent): number | null {
  if (centers.value.length === 0) measureCenters();
  const local = localPoint(event);
  const root = rootRef.value;
  const sample = root?.querySelector<HTMLElement>("[data-node]");
  const reach = (sample?.offsetWidth ?? 40) * 0.62;
  let best: number | null = null;
  let bestDist = reach;
  centers.value.forEach((point, index) => {
    const dist = Math.hypot(local.x - point.x, local.y - point.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || props.status !== "idle") return;
  if (event.button !== undefined && event.button !== 0) return;
  measureCenters();
  const index = nodeAt(event);
  if (index === null) return;
  event.preventDefault();
  drawing.value = true;
  path.value = [index];
  pointer.value = localPoint(event);
  pointerId = event.pointerId;
  rootRef.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!drawing.value || event.pointerId !== pointerId) return;
  pointer.value = localPoint(event);
  const index = nodeAt(event);
  if (index === null || path.value.includes(index)) return;
  path.value = [...path.value, index];
}

function endGesture(event: PointerEvent): void {
  if (!drawing.value || event.pointerId !== pointerId) return;
  const submitted = [...path.value];
  drawing.value = false;
  pointer.value = null;
  pointerId = null;
  if (submitted.length > 0) emit("submit", submitted);
}

function onPointerCancel(event: PointerEvent): void {
  if (!drawing.value || event.pointerId !== pointerId) return;
  drawing.value = false;
  pointer.value = null;
  pointerId = null;
  path.value = [];
}

onUnmounted(() => {
  pointerId = null;
});
</script>

<template>
  <div
    ref="rootRef"
    class="d14-lock"
    :class="`d14-lock--${tone}`"
    role="group"
    aria-label="Schéma d'accès"
    :aria-describedby="ariaDescribedby"
    :aria-disabled="disabled"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endGesture"
    @pointercancel="onPointerCancel"
  >
    <div
      class="d14-lock__rails"
      aria-hidden="true"
    >
      <span class="d14-lock__rail d14-lock__rail--h1" />
      <span class="d14-lock__rail d14-lock__rail--h2" />
      <span class="d14-lock__rail d14-lock__rail--h3" />
      <span class="d14-lock__rail d14-lock__rail--v1" />
      <span class="d14-lock__rail d14-lock__rail--v2" />
      <span class="d14-lock__rail d14-lock__rail--v3" />
    </div>
    <svg
      class="d14-lock__svg"
      aria-hidden="true"
    >
      <polyline
        v-if="linePoints"
        class="d14-lock__line"
        :points="linePoints"
      />
    </svg>
    <div
      v-for="index in NODES"
      :key="index"
      class="d14-lock__hit"
      :class="{ 'd14-lock__hit--lit': path.includes(index) }"
      :data-node="index"
    >
      <span class="d14-lock__node" />
    </div>
  </div>
</template>
