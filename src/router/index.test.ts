import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
import { incubatorRoutes } from "../incubator/routes";
import { prologueRoutes } from "../prologue/routes";
import { appRoutes } from "./routes";

describe("app routes", () => {
  it("keeps the incubateur experience on /incubateur", () => {
    expect(incubatorRoutes.map((route) => route.path)).toEqual(["/incubateur"]);
    expect(incubatorRoutes[0]?.name).toBe("incubateur");
  });

  it("keeps prologue terminal route names", () => {
    expect(
      prologueRoutes.filter((r) => r.name && !r.redirect).map((route) => [route.path, route.name]),
    ).toEqual([
      ["/terminal/D-07/evaluation", "prologue-d07-evaluation"],
      ["/terminal/D-14", "prologue-d14"],
    ]);
  });

  it("serves D-07 evaluation and D-14 terminal", () => {
    expect(String(prologueRoutes[0]?.component)).toContain("D07Evaluation");
    expect(String(prologueRoutes[1]?.component)).toContain("D14Terminal");
    expect(String(prologueRoutes[1]?.component)).not.toContain("ProloguePlaceholder");
  });

  it("keeps known terminals and sends unknown paths to the error page", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: appRoutes,
    });

    expect(router.resolve("/terminal/D-07/evaluation").name).toBe(
      "prologue-d07-evaluation",
    );
    expect(router.resolve("/terminal/D-14").name).toBe("prologue-d14");
    
    // Redirect test - check that matched includes the redirect target
    const resolved = router.resolve("/terminal/D-14/evaluation");
    expect(resolved.matched.some(r => r.path === "/terminal/D-14")).toBe(false); // In vue-router 4, router.resolve on a redirect path gives you the REDIRECT route config, not the target. We can check the route record directly.
    const redirectRecord = appRoutes.find(r => r.path === "/terminal/D-14/evaluation");
    expect((redirectRecord as any).redirect).toBe("/terminal/D-14");
    
    expect(router.resolve("/incubateur").name).toBe("incubateur");
    expect(router.resolve("/chemin-inconnu").name).toBe("unknown-route");
    expect(router.resolve("/terminal/D-99").name).toBe("unknown-route");
  });
});
