import assert from "node:assert/strict";
import test from "node:test";
import { SubagentManager } from "./src/manager.ts";
import type { ParentContext, SpawnTask } from "./src/domain.ts";
import {
  createSubagentRuntime,
  parseEnabledBackendNames,
  runTool,
} from "./src/runtime.ts";

const parent: ParentContext = {
  parentCwd: process.cwd(),
  projectTrusted: false,
};

function task(prompt: string): SpawnTask {
  return {
    prompt,
    title: "config test",
    cwd: process.cwd(),
    parent,
  };
}

async function withBackendEnv(
  value: string | undefined,
  run: () => Promise<void>,
) {
  const previous = process.env.PI_SUBAGENT_BACKENDS;
  if (value === undefined) delete process.env.PI_SUBAGENT_BACKENDS;
  else process.env.PI_SUBAGENT_BACKENDS = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.PI_SUBAGENT_BACKENDS;
    else process.env.PI_SUBAGENT_BACKENDS = previous;
  }
}

test("defaults to pi,codex and hides claude", async () => {
  await withBackendEnv(undefined, async () => {
    assert.deepEqual(parseEnabledBackendNames(), ["pi", "codex"]);

    const runtime = createSubagentRuntime();
    try {
      const manager = await runtime.runPromise(SubagentManager);
      await assert.rejects(
        runTool(runtime, manager.spawn("claude", task("hidden backend"))),
        /Backend "claude" is not enabled or available in this session\./,
      );
    } finally {
      await runtime.dispose();
    }
  });
});

test("PI_SUBAGENT_BACKENDS=pi,claude exposes only those backends", async () => {
  await withBackendEnv("pi,claude", async () => {
    assert.deepEqual(parseEnabledBackendNames(), ["pi", "claude"]);
  });
});

test("invalid PI_SUBAGENT_BACKENDS values fail fast", async () => {
  await withBackendEnv("pi,", async () => {
    assert.throws(
      () => createSubagentRuntime(),
      /Invalid PI_SUBAGENT_BACKENDS value/,
    );
  });
});
