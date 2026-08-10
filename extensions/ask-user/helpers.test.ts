import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOM_ANSWER_LABEL,
  moveSelection,
  normalizeOptions,
} from "./helpers.ts";

test("moveSelection wraps both ways", () => {
  assert.equal(moveSelection(0, -1, 3), 2);
  assert.equal(moveSelection(2, 1, 3), 0);
});

test("normalizeOptions keeps string compatibility", () => {
  assert.deepEqual(
    normalizeOptions(["one", { label: "two", description: "d" }]),
    [{ label: "one" }, { label: "two", description: "d" }],
  );
  assert.equal(CUSTOM_ANSWER_LABEL, "Custom");
});
