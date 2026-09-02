import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./questions";

describe("D-07 questions", () => {
  it("exposes eight fixed questions with A–D choices", () => {
    expect(QUESTIONS).toHaveLength(8);
    expect(QUESTIONS.map((question) => question.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const question of QUESTIONS) {
      expect(question.choices.map((choice) => choice.id)).toEqual(["A", "B", "C", "D"]);
    }
  });
});
