# AE Buddy VNext Architecture

## 1. Repo Audit

### Current architecture

- `src/index.ts` starts the CLI and delegates to `src/cli/index.ts`.
- `src-tauri/src/lib.rs` is a thin Tauri v2 shell that exposes runtime config, host-side OpenAI calls, and CEP bridge triggering.
- `src/ui/*` is the desktop React surface. It currently behaves like a plan review console rather than a command palette.
- `src/engine/workflow.ts` is the main orchestration seam shared by CLI and desktop: load context, generate plan, write bundle, poll execution feedback.
- `src/engine/node-host.ts` and `src/ui/lib/desktop-host.ts` adapt the shared workflow to Node and Tauri filesystem/runtime APIs.
- `src/core/*` contains the planning/execution core: planner, OpenAI fallback, validation, deterministic JSX rendering, and prompt rules.
- `after-effects/export-context.jsx` exports AE context to `.motion-buddy/context/ae-context.json`.
- `after-effects/import-generated-script.jsx` reads the current run bundle, executes `generated-script.jsx`, and writes `.motion-buddy/out/execution-result.json`.
- `after-effects/cep-extension/*` is a lightweight auto-execution transport that triggers the same import bridge over local HTTP.

### Current data flow

1. AE writes `.motion-buddy/context/ae-context.json`.
2. CLI or desktop host loads and normalizes the context.
3. Prompt goes through rules or OpenAI planning.
4. A typed `ActionPlan` is validated and rendered to deterministic JSX.
5. `generated-plan.json`, `generated-script.jsx`, and `receipt.json` are written.
6. AE import bridge executes the JSX and writes `execution-result.json`.
7. CLI/desktop reads feedback and finalizes the run log in `.motion-buddy/logs`.

### What already maps to the target product

- Local-first file bridge with explicit artifacts
- Typed AE context normalization
- Deterministic JSX renderer for a supported action vocabulary
- Validation before execution
- Shared engine used by both CLI and desktop
- Thin Tauri host that keeps secrets on the host side
- Execution logging and stale run protection via `runId`

## 2. Gap Analysis

### What exists

- Prompt-first planning workflow
- Deterministic actions and validation
- Desktop shell and a polished inspection UI
- Local audit trail for runs

### What is missing

- Real command registry abstraction
- Recipe model separate from prompt rules
- Command palette search UX with recent/favorite commands
- Typed context model for command availability and suggestions
- Local palette persistence
- Motion memory primitives beyond raw run logs
- Clear separation between domain resolution and planner fallback

### Refactor now

- Introduce a domain layer for commands, recipes, context modeling, and request resolution
- Add local palette persistence under `.motion-buddy/state`
- Thread resolver metadata through generated plans and logs
- Let the UI search known commands before falling back to prompt generation

### Wait until later

- Global hotkey
- Persistent AE IPC beyond the current file/CEP bridge
- Extension/plugin SDK
- Full motion memory ranking/indexing pipeline
- Packaged distribution and update system

## 3. Proposed Architecture

### Folders

```text
src/
├── core/                     # Existing low-level planner, validator, renderer
├── domain/
│   ├── commands/            # Command + recipe registry
│   ├── context/             # Typed derived AE context model
│   ├── persistence/         # Local command palette state
│   └── resolve/             # Input -> command/recipe/generated resolution
├── engine/                  # Shared run orchestration and host contracts
├── shared/                  # Shared types + bridge/runtime contracts
└── ui/                      # Desktop shell and palette surface
```

### Key models

- `AEContextModel`: derived booleans and selection summaries for instant command availability checks
- `RegistryDefinition`: searchable built-in command or recipe definition with aliases, keywords, availability, and deterministic plan builder
- `PlanResolution`: records how a request was resolved (`built-in-command`, `recipe`, `saved-recipe`, or `generated`)
- `CommandStore`: local state for `favoriteIds`, `recentCommands`, and `savedRecipes`

### Execution flow

1. User types into the palette.
2. Registry search scores built-ins, recipes, and saved recipes against the prompt.
3. Resolver prefers a strong deterministic match.
4. If nothing matches strongly enough, existing planner fallback runs.
5. Resulting `GeneratedPlan` still flows through the current validator, JSX renderer, and file bridge.

### Persistence

- `.motion-buddy/context/*`: AE snapshots
- `.motion-buddy/out/*`: generated execution bundle + feedback
- `.motion-buddy/logs/*`: run history
- `.motion-buddy/state/command-store.json`: favorites, recent commands, saved recipes

### Bridge strategy

- Keep the current file bridge and CEP trigger path as the execution source of truth.
- Treat a future persistent AE bridge as a transport upgrade, not a reason to rewrite the domain layer.
- Keep generated JSX deterministic and inspectable even if transport changes later.

## 4. Implementation Plan

### Milestone 1

- Add `domain/` layer
- Add registry, resolver, and context model
- Preserve existing planner as fallback

### Milestone 2

- Add command palette local persistence
- Add recent/favorite/saved-recipe UI affordances
- Persist resolution metadata with runs

### Milestone 3

- Expand deterministic command set to the next AE Buddy surface area
- Add richer context-aware recommendations and motion memory indexing

### Milestone 4

- Introduce higher-performance transport and global invocation UX
- Add plugin/extension seams once command execution is stable
