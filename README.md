# AE Buddy

AE Buddy is a local-first desktop assistant for Adobe After Effects. The product direction is "Raycast for After Effects": a fast command palette, deterministic command execution, context-aware actions, and an inspectable bridge into AE.

Today the repo ships a working foundation for that loop:

1. Export After Effects context.
2. Search commands and recipes in the desktop palette.
3. Resolve the request into a built-in command, recipe, saved recipe, or planner fallback.
4. Validate the resulting `ActionPlan`.
5. Render deterministic JSX locally.
6. Execute through the existing AE file bridge.
7. Record run receipts, execution feedback, and local usage history.

## Current Product Surface

### Desktop app

The main product surface is a Tauri v2 desktop app with a React command-palette UI.

Current capabilities:

- keyboard-first palette with live command matching
- context-aware command availability
- command preview with descriptions and validation feedback
- recent commands and favorite commands
- saved recipes stored locally
- rendered JSX inspection before execution
- run receipts and execution feedback polling

### Shared engine

The desktop app and CLI both use the same TypeScript engine for:

- AE context loading and normalization
- command resolution
- plan validation
- deterministic JSX rendering
- execution bundle writing
- run logging

### Bridge

AE Buddy still uses a local file bridge for reliability and inspectability:

- `after-effects/export-context.jsx` writes `.motion-buddy/context/ae-context.json`
- the engine writes `.motion-buddy/out/generated-plan.json`
- the engine writes `.motion-buddy/out/generated-script.jsx`
- the engine writes `.motion-buddy/out/receipt.json`
- `after-effects/import-generated-script.jsx` executes the generated JSX in After Effects
- After Effects writes `.motion-buddy/out/execution-result.json`

This is intentionally explicit. Generated JSX is reviewable, deterministic commands stay local, and stale results are rejected by `runId`.

## Deterministic Command Pack

AE Buddy now includes a first built-in command pack that resolves without LLM generation when the request matches a known action.

Implemented commands:

- `Center Anchor Point`
- `Parent To Null`
- `Trim Layer To Playhead`
- `Precompose Selection`
- `Easy Ease Selected Keyframes`
- `Toggle Motion Blur`
- `Create Text Layer`

Additional built-ins from the earlier prototype remain available:

- `Offset Selected Layers`
- `Convert Selection To 3D`
- `Wiggle Position`
- `Overshoot Scale`
- `Ensure Camera`
- `Create Shape Grid`
- `Apply Palette`

Current built-in recipes:

- `Camera Push In`
- `Title Pop Color`

Resolver order is fixed:

1. built-in command
2. built-in recipe
3. saved recipe
4. planner fallback

## Architecture

The codebase is now split into clear layers:

```text
src/
├── core/                     # Planner, schema, validator, JSX renderer
├── domain/
│   ├── commands/            # Built-in commands and recipes
│   ├── context/             # Derived AE context model
│   ├── persistence/         # Favorites, recents, saved recipes
│   └── resolve/             # Input -> command/recipe/generated resolution
├── engine/                  # Shared orchestration and host contracts
├── shared/                  # Shared types and runtime contracts
└── ui/                      # React desktop app
```

Supporting docs:

- [VNext architecture audit and migration plan](./docs/ae-buddy-vnext-architecture.md)
- [Desktop architecture notes](./docs/desktop-architecture.md)

## Local Data Model

AE Buddy is local-first. Runtime state is stored under `.motion-buddy/`.

- `.motion-buddy/context/`: AE context exports
- `.motion-buddy/out/`: generated plan, JSX bundle, receipt, execution result
- `.motion-buddy/logs/`: durable run history
- `.motion-buddy/state/command-store.json`: recent commands, favorites, saved recipes, usage stats

## Requirements

- Node.js 20+
- npm
- Adobe After Effects

For desktop app development:

- Rust toolchain
- Tauri system prerequisites for your OS

Optional:

- `OPENAI_API_KEY` for planner fallback when a request does not match a built-in command or recipe

## Environment

Copy `.env.example` to `.env` if you want model-backed fallback planning.

```bash
OPENAI_API_KEY=
MOTION_BUDDY_MODEL=gpt-4.1-mini
```

## Install

```bash
npm install
```

## Development

### Start the desktop app

```bash
npm run app:dev
```

### Start the CLI

```bash
npm run dev -- --prompt "center anchor point"
```

### Typecheck

```bash
npm run check
```

### Run tests

```bash
npm test
```

## After Effects Workflow

### 1. Export context from AE

Run:

`after-effects/export-context.jsx`

This writes the current AE state, including active comp data, selected layers, playhead time, and selected keyframe counts.

### 2. Run a command from AE Buddy

Examples:

- `anchor`
- `parent to null`
- `trim`
- `easy ease`
- `motion blur`
- `create text "Hello World"`

The palette searches titles, aliases, and keywords, then resolves the request against the local registry before considering planner fallback.

### 3. Review validation and generated JSX

AE Buddy validates the plan against the exported AE context before execution. If validation fails, execution is blocked and the error is surfaced in the UI.

### 4. Execute in After Effects

Run:

`after-effects/import-generated-script.jsx`

After Effects executes the generated JSX and writes back a matching `execution-result.json`.

## Status

AE Buddy has moved beyond a prompt-only prototype. The repo now has:

- a real command registry
- context-aware command resolution
- deterministic command execution for the first useful AE command pack
- local palette persistence
- command history and usage tracking
- a stable bridge that can be improved later without rewriting the domain layer

Next major work is expanding recipes and motion memory on top of this foundation.
