# Motion Buddy

Motion Buddy is a local AI assistant for Adobe After Effects.

It takes a natural-language prompt, reads exported After Effects context, produces a typed `ActionPlan`, validates that plan against the current AE state, renders deterministic JSX, and writes a reviewable execution bundle before anything is applied in After Effects.

The repository currently contains three surfaces built on the same engine:

- a TypeScript CLI for prompt-first local workflows
- a Tauri desktop app with a React UI for plan review, script inspection, and execution control
- a scaffolded CEP panel extension for future in-app After Effects integration

## What It Does

Motion Buddy is designed around a transparent bridge workflow instead of hidden automation:

1. Export context from After Effects.
2. Generate a structured plan from a prompt.
3. Validate the plan.
4. Render deterministic JSX locally.
5. Write an execution bundle into `.motion-buddy/out`.
6. Apply that bundle in After Effects with the import bridge script.
7. Read execution feedback back into the CLI or desktop app.

The goal is controllable AE automation with full visibility into what will run.

## Current Surfaces

### CLI

The CLI uses the shared planning engine directly and is the fastest way to test prompts.

Use it when you want:

- terminal-first workflows
- dry-run review before writing files
- a simple prompt/confirm/apply loop

### Desktop App

The desktop app wraps the same engine in a Tauri shell with a React interface.

It adds:

- AE context inspection
- prompt composition
- ActionPlan review
- rendered JSX inspection
- run history
- execution feedback polling
- session overrides for model and API key

### CEP Panel Scaffold

There is also a new scaffold under `after-effects/cep-extension/` for a future native After Effects panel workflow. It is not yet wired into the main build or release process, but it provides the basic CEP structure, host script placeholders, and a `Generate & Apply` flow stub.

## Supported Action Types

The current shared engine supports these action types:

- `ensure_active_comp`
- `offset_selected_layers`
- `convert_selected_layers_to_3d`
- `apply_expression_to_selected_property`
- `animate_overshoot_scale_on_selected_layers`
- `ensure_camera`
- `animate_camera_push`
- `create_shape_grid`
- `apply_palette_to_selected_layers`

The local rules engine maps common prompt patterns to these actions. When `OPENAI_API_KEY` is configured, Motion Buddy can interpret a broader range of prompts, but it still resolves them into the same structured action vocabulary.

## Repository Layout

```text
.
├── after-effects/
│   ├── cep-extension/            # Scaffolded CEP panel extension
│   ├── export-context.jsx        # AE -> Motion Buddy context exporter
│   └── import-generated-script.jsx
├── docs/
│   └── desktop-architecture.md
├── examples/
├── src/
│   ├── ae/                       # AE-facing helpers
│   ├── cli/                      # CLI entrypoint and prompt flow
│   ├── core/                     # Planning, validation, rendering, model integration
│   ├── engine/                   # Shared orchestration and host contracts
│   ├── shared/                   # Shared types and AE context normalization
│   └── ui/                       # React desktop UI
├── src-tauri/                    # Tauri desktop shell
├── .motion-buddy/                # Local runtime exchange artifacts
├── Motion_Buddy_Quickstart.md
└── README.md
```

## How The Bridge Works

Motion Buddy is file-based today. The engine expects a local `.motion-buddy` directory with these subfolders:

- `.motion-buddy/context`
- `.motion-buddy/out`
- `.motion-buddy/logs`

Important files:

- `.motion-buddy/context/ae-context.json`: exported AE context snapshot
- `.motion-buddy/out/generated-plan.json`: structured ActionPlan for the current run
- `.motion-buddy/out/generated-script.jsx`: JSX ready to run in AE
- `.motion-buddy/out/receipt.json`: execution bundle metadata
- `.motion-buddy/out/execution-result.json`: AE feedback written after execution
- `.motion-buddy/logs/*.json`: run history and audit trail

## Prerequisites

### Required

- Node.js 20+ recommended
- npm
- Adobe After Effects

### For Desktop App Development

- Rust toolchain
- Tauri system prerequisites for your OS

### Optional

- `OPENAI_API_KEY` for broader prompt interpretation

Without an API key, Motion Buddy falls back to the built-in local rules engine.

## Environment Variables

Copy `.env.example` to `.env` and set any overrides you need.

```bash
OPENAI_API_KEY=
MOTION_BUDDY_MODEL=gpt-4.1-mini
```

Variables:

- `OPENAI_API_KEY`: enables the OpenAI-backed planner
- `MOTION_BUDDY_MODEL`: overrides the default model used by the planner

## Installation

```bash
npm install
```

## CLI Workflow

### 1. Export AE Context

In After Effects, run:

`after-effects/export-context.jsx`

This writes the current composition and selected layer data to `.motion-buddy/context/ae-context.json`.

### 2. Generate A Plan

Run the CLI with a prompt:

```bash
npm run dev -- --prompt "Offset selected layers by 5 frames"
```

Useful flags:

- `--prompt "<text>"`: provide the prompt directly
- `--dry-run`: generate and validate without writing an execution bundle
- `--yes`: skip confirmation prompts

Example dry run:

```bash
npm run dev -- --prompt "Create a centered shape grid" --dry-run
```

### 3. Write And Apply The Bundle

If the plan passes validation and you approve it, Motion Buddy writes:

- `generated-plan.json`
- `generated-script.jsx`
- `receipt.json`

Then, in After Effects, run:

`after-effects/import-generated-script.jsx`

That script executes the generated JSX and writes `execution-result.json`.

## Desktop App Workflow

Start the app:

```bash
npm run app:dev
```

In the desktop UI you can:

- inspect the current AE context
- compose or edit prompts
- generate a typed ActionPlan
- inspect validation issues
- inspect the rendered JSX
- write the execution bundle
- open the export/import bridge scripts
- browse run logs and execution feedback

The desktop app polls for `execution-result.json` after you write a run and execute the AE import bridge.

## CEP Panel Scaffold

The scaffold lives under:

`after-effects/cep-extension/`

Included files:

- `CSXS/manifest.xml`
- `index.html`
- `css/style.css`
- `js/main.js`
- `jsx/hostscript.jsx`

Current status:

- the UI shell exists
- the CSInterface flow is wired
- `exportContext()` and `applyGeneratedScript()` are placeholders
- `callMotionBuddyBackend()` is an HTTP stub
- Adobe's `CSInterface.js` still needs to be copied into the extension folder

See `after-effects/cep-extension/README.md` for setup details.

## Local Commands

- `npm run dev`: run the CLI
- `npm run build`: build the engine and Vite UI assets
- `npm run build:engine`: compile the shared TypeScript engine
- `npm run build:ui`: build the React UI with Vite
- `npm run check`: type-check engine and UI
- `npm run start`: run the built Node output
- `npm run ui:dev`: run the Vite UI in development
- `npm run preview`: preview the built Vite UI
- `npm run app:dev`: run the Tauri desktop app
- `npm run app:build`: build the Tauri desktop app

## Architecture Summary

### Shared Engine

The shared planning system lives in `src/core`, `src/shared`, and `src/engine`.

Key responsibilities:

- prompt -> structured `ActionPlan`
- plan validation against AE context
- deterministic JSX rendering
- execution bundle writing
- run log creation and finalization

### Host Adapters

- `src/engine/node-host.ts`: filesystem host used by the CLI
- `src/ui/lib/desktop-host.ts`: Tauri-backed host used by the desktop app

### Desktop UI

The desktop UI is implemented in `src/ui` and includes panels for:

- context
- prompt and planning
- rendered script and execution
- log history and feedback

See `docs/desktop-architecture.md` for the current design rationale.

## Validation And Safety Model

Motion Buddy does not execute arbitrary natural-language requests directly.

Instead it:

1. converts the prompt into a typed plan
2. validates that plan against the exported AE context
3. renders deterministic JSX from the validated action set
4. requires an explicit user step before After Effects executes the script

If validation fails, execution is blocked.

## Logs And Debugging

Each run is logged locally in `.motion-buddy/logs`.

That log captures:

- the prompt
- exported context
- generated explanation
- structured ActionPlan
- validation results
- rendered JSX
- execution feedback if available

This makes prompt behavior inspectable and reproducible.

## Known Limitations

- The After Effects integration is still file-based.
- The desktop app depends on exported context rather than direct AE IPC.
- The CEP panel is scaffolded but not production-integrated yet.
- Packaging, signing, and release automation are still minimal.

## Roadmap Direction

Near-term logical next steps:

- persist settings such as API key and model overrides
- improve execution status handling between AE and the desktop shell
- productize the CEP panel flow
- add release packaging and signing polish

## License

No license file is included yet. Add one before publishing if you intend the repository to be reused publicly.
