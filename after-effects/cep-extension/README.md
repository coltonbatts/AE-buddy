# Motion Buddy CEP Panel Scaffold

This folder contains a minimal Adobe CEP panel scaffold for After Effects CC 2022+.

## Files

- `CSXS/manifest.xml`: CEP manifest and panel registration
- `index.html`: Panel markup
- `css/style.css`: Dark AE-style UI
- `js/main.js`: Panel orchestration and backend stub
- `jsx/hostscript.jsx`: ExtendScript host functions called from the panel

## Before Loading The Panel

1. Copy the official Adobe `CSInterface.js` file into:

   `after-effects/cep-extension/js/vendor/CSInterface.js`

2. Install or symlink this `cep-extension` folder into your CEP extensions directory.

   macOS:
   `~/Library/Application Support/Adobe/CEP/extensions/MotionBuddy`

   Windows:
   `%APPDATA%/Adobe/CEP/extensions/MotionBuddy`

3. If you are debugging unsigned extensions locally, enable PlayerDebugMode for CEP on your machine.

## Where To Plug In Your Existing Logic

- Replace `exportContext()` inside `jsx/hostscript.jsx` with your current exporter.
- Replace `callMotionBuddyBackend()` inside `js/main.js` with your local server or CLI call.
- Extend `applyGeneratedScript()` inside `jsx/hostscript.jsx` if you want your current execution result handling.

## Default Exchange Location

The scaffold writes to:

`Folder.userData/Motion Buddy/.motion-buddy`

That avoids depending on the extension install path. If you want to keep using your repository-local `.motion-buddy` folder instead, update `mbGetExchangeFolder()` in `jsx/hostscript.jsx`.
