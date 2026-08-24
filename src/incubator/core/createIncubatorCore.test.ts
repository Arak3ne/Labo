import { describe, expect, it } from "vitest";
import * as publicApi from "./index";
import { createIncubatorCore } from "./createIncubatorCore";
import type { IncubatorSession, IncubatorSubjectId } from "../types";

const operator: IncubatorSession = { actorId: "A3", actor: "joueur" };
const admin: IncubatorSession = { actorId: "admin-1", actor: "admin" };

function pair(
  left: IncubatorSubjectId,
  right: IncubatorSubjectId,
): [IncubatorSubjectId, IncubatorSubjectId] {
  return [left, right];
}

function grantConsent(
  core: ReturnType<typeof createIncubatorCore>,
  session: IncubatorSession,
  subjects: [IncubatorSubjectId, IncubatorSubjectId],
) {
  const created = core.createConsent(session, subjects);
  if (!created.ok) {
    throw new Error(created.reason);
  }
  const parties = new Set([session.actorId, subjects[0], subjects[1]]);
  for (const actorId of parties) {
    const accepted = core.acceptConsent({ actorId, actor: "joueur" }, created.consent.id);
    if (!accepted.ok) {
      throw new Error(accepted.reason);
    }
  }
  return created.consent;
}

describe("createIncubatorCore", () => {
  it("seeds 16 mocked players with actif and archivé statuses", () => {
    const core = createIncubatorCore();
    const players = core.listPlayers();
    expect(players).toHaveLength(16);
    expect(players.map((player) => player.id)).toEqual([
      "A1", "A2", "A3", "A4",
      "B1", "B2", "B3", "B4",
      "C1", "C2", "C3", "C4",
      "D1", "D2", "D3", "D4",
    ]);
    expect(players.map((player) => player.displayName)).toEqual(
      players.map((player) => `Sujet ${player.id}`),
    );
    expect(players.filter((player) => player.status === "archivé").map((player) => player.id)).toEqual([
      "D2",
      "D3",
      "D4",
    ]);
    expect(players.every((player) => player.status === "actif" || player.status === "archivé")).toBe(true);
  });

  it("exposes a numeric archive selection cost for the UI", () => {
    const core = createIncubatorCore();
    expect(core.archiveSelectionCost).toBe(publicApi.ARCHIVE_SELECTION_COST);
    expect(core.config.archiveSelectionCost).toBe(1);
    expect(typeof core.archiveSelectionCost).toBe("number");
  });

  it("returns only the connected player's safe personal projection", () => {
    const core = createIncubatorCore({ accessAllowance: 3 });
    const projection = core.getPersonalProjection({
      actorId: "A1",
      actor: "joueur",
    });

    expect(projection).toEqual({
      player: {
        id: "A1",
        displayName: "Sujet A1",
        status: "actif",
      },
      access: {
        allowed: true,
        used: 0,
        remaining: 3,
      },
    });
    expect(Object.keys(projection ?? {})).toEqual(["player", "access"]);
    expect(JSON.stringify(projection)).not.toMatch(
      /signature|allele|genotype|adn|admin|game.?master|gm|players|history/i,
    );
  });

  it("does not expose a personal player projection for admin or unknown sessions", () => {
    const core = createIncubatorCore();

    expect(core.getPersonalProjection(admin)).toBeUndefined();
    expect(
      core.getPersonalProjection({ actorId: "inconnu", actor: "joueur" }),
    ).toBeUndefined();
  });

  it("authorizes open, select, and launch separately", () => {
    const core = createIncubatorCore();
    expect(core.authorizeOpen(operator).allowed).toBe(true);
    expect(core.authorizeSelect(operator, ["A1"]).allowed).toBe(true);
    expect(core.authorizeSelect(operator, ["A1", "A2"]).allowed).toBe(true);
    expect(core.authorizeLaunch(operator, { subjectIds: pair("A1", "A2") }).allowed).toBe(
      false,
    );
    expect(core.authorizeLaunch(operator, { subjectIds: pair("A1", "A2") }).reason).toBe(
      "consent_required",
    );
  });

  it("refuses unknown sessions and invalid cobaye pairs", () => {
    const core = createIncubatorCore();
    expect(core.authorizeOpen({ actorId: "inconnu", actor: "joueur" }).reason).toBe("not_authenticated");
    expect(core.authorizeSelect(operator, []).reason).toBe("invalid_subject_count");
    expect(core.authorizeSelect(operator, ["A1", "A1"]).reason).toBe("duplicate_subjects");
    expect(core.authorizeSelect(operator, ["A1", "ghost"]).reason).toBe("unknown_subject");
    expect(
      core.startAnalysis(operator, { subjectIds: pair("A1", "A2"), consentId: "missing" }).reason,
    ).toBe("consent_required");
  });

  it("allows an archived player as cobaye", () => {
    const core = createIncubatorCore();
    expect(core.authorizeSelect(operator, ["D2", "A1"]).allowed).toBe(true);
    const consent = grantConsent(core, operator, pair("D2", "A1"));
    const result = core.startAnalysis(operator, {
      subjectIds: pair("D2", "A1"),
      consentId: consent.id,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.subjectIds).toEqual(["D2", "A1"]);
    }
  });

  it("blocks analysis without complete consent and after a refusal", () => {
    const core = createIncubatorCore();
    const created = core.createConsent(operator, pair("A1", "A4"));
    if (!created.ok) {
      throw new Error(created.reason);
    }
    expect(
      core.startAnalysis(operator, {
        subjectIds: pair("A1", "A4"),
        consentId: created.consent.id,
      }).reason,
    ).toBe("consent_incomplete");

    core.acceptConsent(operator, created.consent.id);
    core.acceptConsent({ actorId: "A1", actor: "joueur" }, created.consent.id);
    core.refuseConsent({ actorId: "A4", actor: "joueur" }, created.consent.id);

    expect(
      core.startAnalysis(operator, {
        subjectIds: pair("A1", "A4"),
        consentId: created.consent.id,
      }).reason,
    ).toBe("consent_refused");
  });

  it("returns only a public 0|1|M code and never signatures on a completed run", () => {
    const core = createIncubatorCore();
    const zeroConsent = grantConsent(core, operator, pair("A2", "B3"));
    const oneConsent = grantConsent(core, operator, pair("A2", "B2"));

    const zero = core.startAnalysis(operator, {
      subjectIds: pair("A2", "B3"),
      consentId: zeroConsent.id,
    });
    const one = core.startAnalysis(operator, {
      subjectIds: pair("A2", "B2"),
      consentId: oneConsent.id,
    });

    expect(one.ok && one.run.code).toBe("1");
    expect(zero.ok && zero.run.code).toBe("0");

    if (!zero.ok) {
      throw new Error(zero.reason);
    }
    expect(zero.run.actor).toBe("joueur");
    expect(zero.run.consentIds).toEqual([zeroConsent.id]);
    expect(zero.run.subjectIds).toHaveLength(2);
    expect(zero.run.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(zero.run)).not.toMatch(/signature|allele|genotype|adn|dna|[αβγδ]/i);
    expect(zero.run).toEqual({
      id: zero.run.id,
      subjectIds: ["A2", "B3"],
      code: "0",
      timestamp: zero.run.timestamp,
      actor: "joueur",
      actorId: "A3",
      consentIds: [zeroConsent.id],
    });
  });

  it("exposes and consumes a server access counter", () => {
    const core = createIncubatorCore({ accessAllowance: 1 });
    expect(core.getAccessCounter(operator)).toEqual({ used: 0, remaining: 1 });
    const consent = grantConsent(core, operator, pair("B1", "B2"));
    const first = core.startAnalysis(operator, {
      subjectIds: pair("B1", "B2"),
      consentId: consent.id,
    });
    expect(first.ok).toBe(true);
    expect(core.getAccessCounter(operator)).toEqual({ used: 1, remaining: 0 });

    const again = grantConsent(core, operator, pair("B3", "B4"));
    expect(
      core.startAnalysis(operator, {
        subjectIds: pair("B3", "B4"),
        consentId: again.id,
      }).reason,
    ).toBe("access_exhausted");
  });

  it("lets an admin bypass access, ignore consent, run archived subjects, and correct history", () => {
    const gated = createIncubatorCore();
    expect(
      gated.startAnalysis(operator, {
        subjectIds: pair("A1", "A2"),
        ignoreConsent: true,
      }).reason,
    ).toBe("admin_required");

    const core = createIncubatorCore({ accessAllowance: 0 });
    expect(core.authorizeOpen(admin).allowed).toBe(true);

    const ignored = core.admin.startAnalysis(admin, {
      subjectIds: pair("D4", "A1"),
      ignoreConsent: true,
    });
    expect(ignored.ok).toBe(true);
    if (!ignored.ok) {
      throw new Error(ignored.reason);
    }
    expect(ignored.run.actor).toBe("admin");
    expect(ignored.run.consentIds).toEqual([]);
    expect(["0", "1", "M"]).toContain(ignored.run.code);

    const created = core.createConsent(admin, pair("D2", "D3"));
    if (!created.ok) {
      throw new Error(created.reason);
    }
    const forced = core.admin.forceConsent(admin, created.consent.id);
    expect(forced.ok).toBe(true);

    const forcedRun = core.admin.startAnalysis(admin, {
      subjectIds: pair("D2", "D3"),
      consentId: created.consent.id,
    });
    expect(forcedRun.ok).toBe(true);

    const corrected = core.admin.correctRun(admin, ignored.run.id, { code: "0" });
    expect(corrected.ok && corrected.run.code).toBe("0");
    expect(core.getRun(ignored.run.id)?.code).toBe("0");
    expect(core.admin.correctRun(operator, ignored.run.id, { code: "1" }).ok).toBe(false);
    expect(JSON.stringify(core.listHistory())).not.toMatch(
      /signature|allele|genotype|adn|dna|[αβγδ]/i,
    );
  });

  it("does not export server signature helpers from the public barrel", () => {
    expect("createIncubatorCore" in publicApi).toBe(false);
    expect("computeRevealCode" in publicApi).toBe(false);
    expect("seedBiologicalSignatures" in publicApi).toBe(false);
    expect("readSignatureForCompare" in publicApi).toBe(false);
    expect("CANONICAL_BIOLOGICAL_SIGNATURES" in publicApi).toBe(false);
    expect("evaluateFinalProtocol" in publicApi).toBe(false);
    expect("CANONICAL_PLAYER_CODE_HASHES" in publicApi).toBe(false);
    expect("verifyCanonicalPlayerCode" in publicApi).toBe(false);
  });
});
