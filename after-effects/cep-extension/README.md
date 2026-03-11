# Motion Buddy CEP Auto-Execution Bridge

This CEP extension is a tiny After Effects panel that keeps a local HTTP bridge open for Motion Buddy Studio.

## What it does

1. The Tauri app writes `generated-script.jsx` and `receipt.json` into the existing repo-local `.motion-buddy/out` folder.
2. The Tauri app POSTs to `http://127.0.0.1:9123/motion-buddy/execute`.
3. The CEP panel receives the command and asks After Effects to evaluate `after-effects/import-generated-script.jsx`.
4. `import-generated-script.jsx` validates the `runId`, wraps the execution in `app.beginUndoGroup("Motion Buddy Action")`, runs the generated JSX, and writes `execution-result.json`.

The CEP panel stays dumb: no API keys, no model calls, and no direct script generation.

## Trigger payload

The Tauri host sends:

```json
{
  "runId": "2026-03-11T18-04-05-123Z-uuid",
  "importScriptPath": "/absolute/path/to/after-effects/import-generated-script.jsx",
  "suppressAlerts": true
}
```

## Files

- `CSXS/manifest.xml`: CEP registration and panel sizing
- `index.html`: Tiny bridge UI for status and logs
- `css/style.css`: Small dockable panel styling
- `js/main.js`: Local HTTP listener and AE dispatch logic
- `jsx/hostscript.jsx`: ExtendScript functions invoked from the panel

## Local install

1. Copy Adobe's official `CSInterface.js` into `after-effects/cep-extension/js/vendor/CSInterface.js`.
2. Symlink or copy this folder to your CEP extensions directory.

macOS:
`~/Library/Application Support/Adobe/CEP/extensions/MotionBuddyBridge`

Windows:
`%APPDATA%/Adobe/CEP/extensions/MotionBuddyBridge`

3. Enable CEP debug mode locally if needed.
4. Open After Effects, then open the `Motion Buddy Bridge` panel from `Window > Extensions`.
5. Keep the panel open while using Motion Buddy Studio.

## Runtime notes

- Default bridge endpoint: `http://127.0.0.1:9123/motion-buddy/execute`
- Override from the Tauri side with `MOTION_BUDDY_CEP_URL`
- Health check endpoint: `http://127.0.0.1:9123/motion-buddy/health`
- If the panel is closed or the port is unreachable, Motion Buddy Studio falls back to the existing manual import step
