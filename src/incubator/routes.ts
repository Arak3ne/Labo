import type { RouteRecordRaw } from "vue-router";

export const incubatorRoutes: RouteRecordRaw[] = [
  {
    path: "/incubateur",
    name: "incubateur",
    component: () => import("./ui/IncubatorShell.vue"),
  },
];
