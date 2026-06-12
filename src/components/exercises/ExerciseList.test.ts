import { describe, expect, it } from "vitest";
import { moveExerciseIds } from "./ExerciseList";

describe("moveExerciseIds", () => {
  it("moves an exercise id from one index to another", () => {
    expect(moveExerciseIds(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("returns the original order when moving past list bounds", () => {
    expect(moveExerciseIds(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveExerciseIds(["a", "b", "c"], 2, 3)).toEqual(["a", "b", "c"]);
  });
});
