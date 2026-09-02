import { createRouter, createWebHistory } from "vue-router";
import { incubatorRoutes } from "../incubator/routes";
import { prologueRoutes } from "../prologue/routes";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: { name: "prologue-d07-evaluation" },
    },
    ...incubatorRoutes,
    ...prologueRoutes,
  ],
});

export default router;
