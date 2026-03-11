import assert from "node:assert/strict";
import test from "node:test";

import { emptyContext } from "../shared/ae-context.js";
import type { ActionPlan } from "../shared/types.js";
import { renderActionPlan } from "./action-plan-renderer.js";

test("easy ease renderer recursively collects selected animatable properties", () => {
  const script = renderActionPlan(
    {
      version: "1.0",
      intent: "Easy ease",
      summary: "Easy ease",
      riskLevel: "low",
      assumptions: [],
      warnings: [],
      actions: [{ type: "easy_ease_selected_keyframes", easeInfluence: 70 }],
    } satisfies ActionPlan,
    emptyContext(),
  );

  assert.match(script, /function mbCollectSelectedAnimatableProperties/);
  assert.match(script, /mbCollectSelectedAnimatableProperties\(selectedLayers\[i\]\.selectedProperties, layerProperties\)/);
});

test("anchor centering renderer skips unsupported layers and warns on partial application", () => {
  const script = renderActionPlan(
    {
      version: "1.0",
      intent: "Center anchor",
      summary: "Center anchor",
      riskLevel: "low",
      assumptions: [],
      warnings: [],
      actions: [{ type: "center_anchor_point_on_selected_layers" }],
    } satisfies ActionPlan,
    emptyContext(),
  );

  assert.match(script, /mbAnchorAppliedCount/);
  assert.match(script, /No selected layers supported deterministic anchor centering/);
  assert.match(script, /Some selected layers could not be anchor-centered deterministically/);
});

test("motion blur renderer uses safe read and write helpers", () => {
  const script = renderActionPlan(
    {
      version: "1.0",
      intent: "Toggle motion blur",
      summary: "Toggle motion blur",
      riskLevel: "low",
      assumptions: [],
      warnings: [],
      actions: [{ type: "toggle_motion_blur_on_selected_layers" }],
    } satisfies ActionPlan,
    emptyContext(),
  );

  assert.match(script, /function mbReadMotionBlurState/);
  assert.match(script, /function mbWriteMotionBlurState/);
  assert.match(script, /Some selected layers did not support motion blur changes/);
});
