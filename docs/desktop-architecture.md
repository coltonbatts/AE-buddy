# Motion Buddy Desktop Architecture

## Goal

Add a production-oriented GUI without splitting the core logic away from the existing CLI.

## High-Level Design

### Shared engine

The deterministic planning stack stays in TypeScript and is shared by both surfaces:

- `src/core/*`
  - prompt-to-ActionPlan generation
  - JSON validation
  - deterministic JSX rendering
- `src/shared/*`
  - cross-surface type definitions
  - AE context normalization
- `src/engine/workflow.ts`
  - shared orchestration for prepare, commit, feedback, and history loading

### CLI surface

- `src/cli/index.ts`
  - interactive prompt flow
  - dry-run output
  - confirm and wait loop

### Desktop surface

- `src/ui/*`
  - React interface
  - Tauri file-system host adapter
  - prompt history and execution event feed
- `src-tauri/*`
  - desktop shell
  - runtime config bridge
  - plugin registration for filesystem, dialog, and opener support

## Data Flow

```text
UI prompt
  -> shared workflow.prepareRun()
  -> load normalized AE context
  -> generate ActionPlan
  -> validate plan
  -> render JSX
  -> write run log
  -> show plan + script

Execute
  -> shared workflow.commitPreparedRun()
  -> write generated-plan.json
  -> write generated-script.jsx
  -> write receipt.json
  -> user runs AE import bridge
  -> AE writes execution-result.json
  -> desktop poller reads feedback
  -> workflow.readExecutionFeedback()
  -> finalize stored log
```

## Rationale

- Tauri keeps the app lightweight and desktop-native.
- The GUI does not regenerate logic independently from the CLI.
- All generated artifacts remain inspectable before execution.
- AE integration stays transparent by preserving the existing bridge files.

## Key Modules

### Shared runtime model

- `src/shared/types.ts`
- `src/shared/ae-context.ts`

### Planning engine

- `src/core/generator.ts`
- `src/core/openai-generator.ts`
- `src/core/action-plan-validator.ts`
- `src/core/action-plan-renderer.ts`

### Host adapters

- `src/engine/node-host.ts`
  - Node filesystem host for CLI
- `src/ui/lib/desktop-host.ts`
  - Tauri filesystem host for desktop UI

### Desktop UX modules

- `src/ui/components/context-panel.tsx`
- `src/ui/components/prompt-panel.tsx`
- `src/ui/components/script-panel.tsx`
- `src/ui/components/log-panel.tsx`

## Tradeoffs

- The desktop app still depends on the file bridge rather than direct AE IPC.
- The UI currently allows a session API key override for local use because the shared TypeScript planner is used in the webview layer.
- Tauri bundling polish is intentionally deferred so the repo focuses on the workflow and interface first.

## Next Logical Steps

1. Add settings persistence for model and API key overrides.
2. Replace polling with richer bridge status events if the AE side becomes more interactive.
3. Add packaged app icons, signing metadata, and release automation.
4. Introduce an AE panel integration once the file bridge is no longer the primary transport.
