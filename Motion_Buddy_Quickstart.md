# 🎬 Motion Buddy Quickstart Guide

**Motion Buddy** is your local AI assistant for Adobe After Effects. It turns your natural-language prompts into safe, validated scripts that execute directly in AE.

---

## 🚀 The 3-Step Workflow

Using Motion Buddy is a simple bridge between After Effects and your terminal. Here is the daily workflow:

### 1. Export Your AE Context
First, tell Motion Buddy what you're currently working on in After Effects.
* **In After Effects:** Run the script `after-effects/export-context.jsx`.
* *(This saves your active comp, selected layers, and camera info so Motion Buddy knows what to target).*

### 2. Prompt Motion Buddy
Next, tell Motion Buddy what you want to do using plain English.
* **In your Terminal:** Run the CLI with your prompt:
  ```bash
  npm run dev -- --prompt "Offset all selected layers by 5 frames"
  ```
* **Review & Confirm:** The CLI will display a **Dry-Run Summary**, showing you exactly what it plans to do, the risks, and the generated code. If it looks correct, confirm the execution.

### 3. Apply the Script in AE
Finally, bring the generated animation or changes back into After Effects.
* **In After Effects:** Run the script `after-effects/import-generated-script.jsx`.
* *(This applies the changes to your project!)*

---

## 🛠 Supported Actions
Motion Buddy natively supports several powerful actions out of the box:
* `offset_selected_layers`: Create stagger effects instantly.
* `convert_selected_layers_to_3d`: Quickly toggle 3D on multiple targets.
* `animate_overshoot_scale_on_selected_layers`: Add smooth pop-in animations.
* `ensure_camera` & `animate_camera_push`: Easily build camera rigs and movements.
* `create_shape_grid`: Generate perfect grids of shapes.
* `apply_palette_to_selected_layers`: Auto-color your design.

---

## 💡 Quick Tips
* **Dry-Run Only:** Just want to see what the AI *would* do without writing any files? Add `--dry-run` to your command:
  `npm run dev -- --prompt "Create a centered shape grid" --dry-run`
* **Logs & Debugging:** Every run is securely logged locally. If something goes wrong, you can always check your `.motion-buddy/logs/` folder to see the exact prompt and generated script.
