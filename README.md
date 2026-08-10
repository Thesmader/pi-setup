# My Pi setup

My personal configuration for [Pi](https://github.com/badlogic/pi-mono), designed to be checked out directly at `~/.pi/agent`.

## What it includes

### Interface

- Fullscreen TUI with an animated Pi header
- Two-line footer with Git branch, pull request, model, and context usage
- Vim editing with `Ctrl+P` / `Ctrl+N` selection navigation
- Tokyo Night Moon, Kanagawa Wave, Rosé Pine Moon, and GitHub Dark themes

### Tools

- Local fuzzy file and content search through `pi-fff`
- Web research through `pi-web-access` and `pi-codex-search`
- `ask_user` for focused multiple-choice clarifications
- `/context` for inspecting context allocation

### Execution

- Background terminals with the `/ps` dashboard
- Pi and Codex subagents by default, with Claude available as an opt-in backend
- Sandboxed workflows loaded on demand so the full workflow tool does not occupy the initial context

## Install

```sh
git clone git@github.com:Thesmader/my-pi-setup.git ~/.pi/agent
cd ~/.pi/agent
pnpm install
cp settings.example.json settings.json
```

See [SETUP.md](SETUP.md) for global skills, Herdr, and backend configuration.

## Repository boundaries

This repository owns Pi-specific extensions, themes, and tightly coupled skills. Private and generated state such as `settings.json`, authentication, sessions, package caches, and Herdr-managed integration files stays untracked. Third-party skills installed globally with `npx skills` live under `~/.agents/skills` instead of being copied here.

## Development

```sh
pnpm check
pnpm test
pnpm format:check
```

Based on [davis7dotsh/my-pi-setup](https://github.com/davis7dotsh/my-pi-setup), then substantially customized as an independent personal setup.
