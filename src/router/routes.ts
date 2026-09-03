import type { RouteRecordRaw } from "vue-router";
import { incubatorRoutes } from "../incubator/routes";
import { prologueRoutes } from "../prologue/routes";

export const appRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: { name: "prologue-d07-evaluation" },
  },
  ...incubatorRoutes,
  ...prologueRoutes,
  {
    path: "/:pathMatch(.*)*",
    name: "unknown-route",
    component: () => import("./UnknownRoute.vue"),
  },
];
