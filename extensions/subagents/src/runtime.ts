/**
 * Layer composition and the async entry-point boundary.
 *
 * Everything inside the extension is Effect generators; this module is where
 * tool handlers (plain async functions) run those effects against one shared
 * ManagedRuntime.
 */

import { Cause, Exit, Layer, ManagedRuntime, type Effect } from "effect";
import { BackendRegistry, type SubagentBackend } from "./backend.ts";
import { claudeBackend } from "./backends/claude.ts";
import { codexBackend } from "./backends/codex.ts";
import { piBackend } from "./backends/pi.ts";
import type { BackendName } from "./domain.ts";

const ALL_BACKENDS = {
  pi: piBackend,
  claude: claudeBackend,
  codex: codexBackend,
} satisfies Record<BackendName, SubagentBackend>;

const DEFAULT_BACKENDS = [
  "pi",
  "codex",
] as const satisfies readonly BackendName[];

export function parseEnabledBackendNames(
  value = process.env.PI_SUBAGENT_BACKENDS,
) {
  if (value === undefined) return [...DEFAULT_BACKENDS];
  const names = value.split(",").map((part) => part.trim());
  if (names.length === 0 || names.some((name) => name === "")) {
    throw new Error(
      `Invalid PI_SUBAGENT_BACKENDS value ${JSON.stringify(value)}: use a comma-separated list from pi, codex, claude.`,
    );
  }
  const enabled: BackendName[] = [];
  const seen = new Set<BackendName>();
  for (const name of names) {
    if (!(name in ALL_BACKENDS)) {
      throw new Error(
        `Invalid PI_SUBAGENT_BACKENDS value ${JSON.stringify(value)}: unknown backend ${JSON.stringify(name)}. Use pi, codex, claude.`,
      );
    }
    const backendName = name as BackendName;
    if (seen.has(backendName)) {
      throw new Error(
        `Invalid PI_SUBAGENT_BACKENDS value ${JSON.stringify(value)}: duplicate backend ${JSON.stringify(name)}.`,
      );
    }
    seen.add(backendName);
    enabled.push(backendName);
  }
  return enabled;
}

function createBackendRegistry(backends: readonly SubagentBackend[]) {
  return Layer.sync(BackendRegistry, () => {
    const registry = new Map<BackendName, SubagentBackend>();
    for (const backend of backends) registry.set(backend.name, backend);
    return registry;
  });
}

import { SubagentManagerLive } from "./manager.ts";

export function createSubagentRuntime() {
  const backends = parseEnabledBackendNames().map((name) => ALL_BACKENDS[name]);
  return ManagedRuntime.make(
    SubagentManagerLive.pipe(Layer.provide(createBackendRegistry(backends))),
  );
}

export type SubagentRuntime = ReturnType<typeof createSubagentRuntime>;

/**
 * Run an effect from an async tool handler. Typed failures and defects are
 * converted to thrown Errors (what pi's tool contract expects); interruption
 * (tool AbortSignal) throws `interruptMessage`.
 */
export async function runTool<A, E>(
  runtime: SubagentRuntime,
  effect: Effect.Effect<A, E>,
  options: { signal?: AbortSignal; interruptMessage?: string } = {},
) {
  const exit = await runtime.runPromiseExit(
    effect,
    options.signal ? { signal: options.signal } : undefined,
  );
  if (Exit.isSuccess(exit)) return exit.value;
  if (Cause.hasInterruptsOnly(exit.cause)) {
    throw new Error(options.interruptMessage ?? "Operation was aborted.");
  }
  const [first] = Cause.prettyErrors(exit.cause);
  throw new Error(first?.message ?? Cause.pretty(exit.cause));
}
