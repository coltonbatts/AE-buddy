import assert from "node:assert/strict";
import test from "node:test";

import { parseAeContext } from "../shared/ae-context.js";
import type { ActionPlan } from "../shared/types.js";
import { validatePlanAgainstContext } from "./action-plan-validator.js";

function createContext(overrides: Record<string, unknown> = {}) {
  return parseAeContext({
    exportedAt: new Date().toISOString(),
    projectName: "Test Project",
    activeComp: {
      name: "Main",
      width: 1920,
      height: 1080,
      duration: 10,
      frameRate: 24,
      workAreaStart: 0,
      workAreaDuration: 10,
      displayStartTime: 0,
      currentTime: 2,
      numLayers: 3,
      hasCamera: false,
      activeCameraName: null,
      backgroundColor: [0, 0, 0],
    },
    selectedLayers: [
      {
        index: 1,
        name: "Title",
        type: "text",
        threeD: true,
        inPoint: 0,
        outPoint: 5,
        startTime: 0,
        parentName: "Controller",
        enabled: true,
        locked: false,
        shy: false,
        label: 1,
        selectedProperties: ["Transform"],
        selectedKeyframeCount: 2,
        transform: {},
        textValue: "Hello",
      },
    ],
    notes: [],
    ...overrides,
  });
}

test("center anchor validation warns for parented or 3D layers", () => {
  const result = validatePlanAgainstContext(
    {
      version: "1.0",
      intent: "Center anchor",
      summary: "Center anchor",
      riskLevel: "low",
      assumptions: [],
      warnings: [],
      actions: [{ type: "center_anchor_point_on_selected_layers" }],
    } satisfies ActionPlan,
    createContext(),
  );

  assert.equal(result.ok, true);
  assert.match(
    result.issues.map((issue) => issue.message).join(" | "),
    /Parented or 3D layers may shift slightly/,
  );
});

test("precompose validation blocks locked layers and warns on external parents", () => {
  const result = validatePlanAgainstContext(
    {
      version: "1.0",
      intent: "Precompose",
      summary: "Precompose",
      riskLevel: "medium",
      assumptions: [],
      warnings: [],
      actions: [{ type: "precompose_selected_layers" }],
    } satisfies ActionPlan,
    createContext({
      selectedLayers: [
        {
          index: 1,
          name: "Title",
          type: "text",
          threeD: false,
          inPoint: 0,
          outPoint: 5,
          startTime: 0,
          parentName: "Controller",
          enabled: true,
          locked: true,
          shy: false,
          label: 1,
          selectedProperties: ["Position"],
          selectedKeyframeCount: 0,
          transform: {},
          textValue: "Hello",
        },
      ],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.issues.map((issue) => issue.message).join(" | "), /Unlock the selected layers before precomposing/);
  assert.match(
    result.issues.map((issue) => issue.message).join(" | "),
    /parents outside the selection/,
  );
});
