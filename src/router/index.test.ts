import { describe, expect, it } from "vitest";
import { incubatorRoutes } from "../incubator/routes";
import { prologueRoutes } from "../prologue/routes";

describe("app routes", () => {
  it("keeps the incubateur experience on /incubateur", () => {
    expect(incubatorRoutes.map((route) => route.path)).toEqual(["/incubateur"]);
    expect(incubatorRoutes[0]?.name).toBe("incubateur");
  });

  it("keeps prologue terminal route names", () => {
    expect(
      prologueRoutes.map((route) => [route.path, route.name]),
    ).toEqual([
      ["/terminal/D-07/evaluation", "prologue-d07-evaluation"],
      ["/terminal/D-14", "prologue-d14"],
    ]);
  });

  it("serves D-07 evaluation and keeps D-14 as placeholder", () => {
    expect(String(prologueRoutes[0]?.component)).toContain("D07Evaluation");
    expect(String(prologueRoutes[1]?.component)).toContain("ProloguePlaceholder");
  });
});
