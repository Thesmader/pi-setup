---
name: subagents
description: Use when considering, spawning, or managing subagents, including model and reasoning-effort routing.
---

# Subagents

Each subagent is headless, has its own context window, cannot see the parent conversation, cannot ask the user, and cannot spawn subagents or workflows. Give every child a self-contained prompt with its question, paths, owned scope, constraints, evidence requirement, expected report, and stopping condition.

Use a subagent only when independent, non-overlapping work can meaningfully reduce time or risk. Keep small and sequential work in the parent. At most four subagents run concurrently across all harnesses.

Default enabled harnesses are `pi,codex`. Set `PI_SUBAGENT_BACKENDS` to a comma-separated selection from `pi`, `codex`, and `claude`.

## Model and effort routing

The parent normally starts with Astra at `low`. Use Astra at no more than `medium` unless the user explicitly requests a higher level.

Choose `model` and `reasoning_effort` explicitly for every child so Codex defaults or a high-effort parent cannot silently make all children expensive.

| Work                                                        | Harness | Model                       | Effort   |
| ----------------------------------------------------------- | ------- | --------------------------- | -------- |
| File inventory, grep census, log counting, test enumeration | `pi`    | `openai-codex/gpt-5.6-luna` | `low`    |
| Broader read-only repository mapping                        | `pi`    | `openai-codex/gpt-5.6-luna` | `medium` |
| Bounded implementation                                      | `codex` | `gpt-5.6-sol`               | `high`   |
| Architecture or ambiguous diagnosis                         | `pi`    | `openai-codex/gpt-6-astra`  | `medium` |
| Integration or fresh-context review                         | `pi`    | `openai-codex/gpt-6-astra`  | `medium` |
| Small or sequential task                                    | none    | none                        | none     |

These are routing defaults, not a reason to delegate. If the parent can do the work directly with less coordination, do not spawn a child.

## Pi harness

**Harness:** `pi`

Pi runs an in-process Pi session. It supports model selection, reasoning effort, live steering, normal global resources, and trust-gated project resources.

Use a provider-qualified model such as `openai-codex/gpt-6-astra`. A bare model ID first checks the parent's provider and otherwise must be unique across configured providers.

If `model` is omitted, Pi inherits the parent model. If `reasoning_effort` is omitted, Pi inherits the parent's thinking level. The accepted values map directly to Pi thinking levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`.

Do not use Anthropic-provider models through the Pi harness.

## Codex harness

**Harness:** `codex`

Use Codex CLI for bounded implementation. Pass a bare model slug such as `gpt-5.6-sol`, not a provider-qualified model name.

Codex accepts the shared effort scale and maps it to the nearest effort supported by the selected model:

- `off` and `minimal` prefer `minimal`;
- `low`, `medium`, and `high` remain unchanged when supported;
- `xhigh` and `max` prefer `xhigh`;
- unsupported values are clamped to the nearest effort advertised by Codex.

If `model` or `reasoning_effort` is omitted, Codex uses its own default. Specify both to avoid accidental high-effort children.

Codex requires an installed and authenticated Codex CLI. It does not support live steering; messages sent during a run are queued as follow-up turns.

## Claude Code harness

Claude is available only when `PI_SUBAGENT_BACKENDS` includes `claude` and Claude Code is installed and authenticated.

**Harness:** `claude`

Use a Claude model alias such as `fable`. The shared effort values map to thinking-token budgets:

| Effort    | Tokens |
| --------- | -----: |
| `off`     |      0 |
| `minimal` |  1,024 |
| `low`     |  4,096 |
| `medium`  | 10,000 |
| `high`    | 16,000 |
| `xhigh`   | 32,000 |
| `max`     | 63,999 |

Claude supports live steering. Do not choose this harness by default.

## Spawn and manage

Call `subagent_spawn` with:

- a complete `prompt`;
- a short `name`;
- an enabled `harness`;
- a trusted `working_dir` when different from the current directory;
- an explicit `model` and `reasoning_effort` selected from the routing table.

Spawn independent children together, then continue useful parent work. Results are delivered automatically. If no useful parent work remains, end the current turn and let automatic result delivery resume the conversation when the child settles. Do not poll or wait merely to keep the turn active.

- Use `subagent_check` only when current progress is needed for a decision, expected completion has passed, or failure is suspected.
- Use `subagent_wait` only when missing results block parent progress.
- Use `subagent_cancel` to stop unneeded or stuck work; partial transcripts remain available.
- Use `subagent_list` to inventory tracked runs.
- Use `/subagents` to inspect or take over a run interactively.

If one child fails, inspect and retry only that child. Do not recreate successful siblings. Avoid concurrent edits to the same files; the parent owns integration and final verification.
