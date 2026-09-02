import type { RouteRecordRaw } from "vue-router";

export const prologueRoutes: RouteRecordRaw[] = [
  {
    path: "/terminal/D-07/evaluation",
    name: "prologue-d07-evaluation",
    component: () => import("./d07/D07Evaluation.vue"),
  },
  {
    path: "/terminal/D-14",
    name: "prologue-d14",
    component: () => import("./ProloguePlaceholder.vue"),
  },
];
