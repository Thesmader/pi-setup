# Setup

1. Clone this repo to `~/.pi/agent`.
2. Run one root install:

```sh
cd ~/.pi/agent
pnpm install
```

3. Copy or merge `settings.example.json` into ignored `settings.json`:

```sh
cp ~/.pi/agent/settings.example.json ~/.pi/agent/settings.json
```

Keep any existing local values you need; `settings.json` stays private and untracked.

## Additional Codex accounts

Create the ignored `openai-codex-accounts.json` file to register additional OAuth accounts:

```json
[
  { "id": "openai-codex-work", "label": "work" }
]
```

Then authenticate each provider with `/login openai-codex-work`. Provider IDs must be unique.

## Subagents

Default backend selection is `pi,codex`.

Override with:

```sh
PI_SUBAGENT_BACKENDS=pi,claude
```

## Workflow loader

`load_workflow` is always active. Use it once to enable the full `workflow` tool on demand.

## Herdr

Herdr owns and updates its Pi integration; it is not bundled here. Install it separately with:

```sh
herdr integration install pi
```

## Global skills

Third-party skills are managed globally through `npx skills`, not bundled in this repo. Install Defuddle for Pi with:

```sh
npx skills add joeseesun/defuddle-skill --global --agent pi --skill defuddle --yes
```

## External packages

Install extra Pi packages through `settings.json` only. No manual root package edits.

## Firecrawl

No Firecrawl setup is needed.
