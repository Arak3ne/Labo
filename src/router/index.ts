import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: { name: "incubateur" },
    },
    {
      path: "/incubateur",
      name: "incubateur",
      component: () => import("../incubator/ui/IncubatorPage.vue"),
    },
  ],
});

export default router;
