import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activateWorkflowTool,
  initializeWorkflowActiveTools,
} from "./index.ts";

test("workflow loader keeps itself active and adds workflow", () => {
  assert.deepEqual(
    initializeWorkflowActiveTools(["read", "workflow", "ask_user"]),
    ["read", "ask_user", "load_workflow"],
  );
  assert.deepEqual(activateWorkflowTool(["read", "load_workflow"]), [
    "read",
    "load_workflow",
    "workflow",
  ]);
});
