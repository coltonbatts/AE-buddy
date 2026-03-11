# Live Session Awareness

## Feasibility

- After Effects scripting exposes a single `app.project` context at a time. AE Buddy should treat this as one live project snapshot, not multiple simultaneously inspectable projects.
- The highest-signal live context currently available through the existing bridge is:
  - project name and saved file path when present
  - active comp via `project.activeItem` when the active item is a comp
  - playhead time via `CompItem.time`
  - selected layers and selected keyframe counts
- True push-based realtime sync is not available in the current bridge. Phase 1 therefore uses polling over the existing CEP HTTP bridge plus the file snapshot as the source of truth.
- Recent projects shown in the UI are an observed-project history inside AE Buddy, not proof that After Effects currently has multiple projects open.

## Architecture

### Transport

1. Tauri polls the local CEP bridge every few seconds.
2. CEP asks AE to run `after-effects/export-context.jsx` silently.
3. AE writes `.motion-buddy/context/ae-context.json`.
4. The desktop app loads that file and reduces it into a typed live session state.

### State

- `AEContext` remains the normalized snapshot shape used by planning and execution.
- `AELiveState` adds:
  - connection status: `connected`, `stale`, `disconnected`
  - sync mode: `cep-polling` or `file-fallback`
  - observed `sessions[]` used as recent project history
  - active session id only when the latest snapshot is confirmed live
  - last sync timestamps and last bridge error

### UI

- Left rail:
  - live sync status
  - current focus
  - observed project list
- Main surface:
  - prompt input for the current active context
  - inspected project context
  - freshness timestamps and notes

## Hard Limits

- Multiple open AE projects are not represented as simultaneous live sessions by the scripting API.
- If the CEP panel is closed, AE Buddy can only fall back to the last exported file snapshot and mark it stale/disconnected.
- Polling cadence should stay conservative. Phase 1 uses a 4 second interval to balance responsiveness and safety.
