import type { AEContext, PlannedResponse, RgbColor } from "../types.js";

function defaultPalette(): RgbColor[] {
  return [
    [0.9608, 0.3294, 0.298],
    [0.9961, 0.7725, 0.2314],
    [0.1765, 0.6745, 0.6431],
    [0.149, 0.3529, 0.7216],
  ];
}

function basePlan(params: {
  intent: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  assumptions?: string[];
  warnings?: string[];
}) {
  return {
    version: "1.0" as const,
    intent: params.intent,
    summary: params.summary,
    riskLevel: params.riskLevel,
    assumptions: params.assumptions ?? [],
    warnings: params.warnings ?? [],
    actions: [],
  };
}

function offsetSelectedLayersByFrames(frames: number, frameRate: number): PlannedResponse {
  const seconds = Number((frames / frameRate).toFixed(5));

  return {
    explanation: `The request maps cleanly to offsetting each selected layer by ${frames} frames, which is ${seconds} seconds at ${frameRate} fps.`,
    actionPlan: {
      ...basePlan({
        intent: "Offset the currently selected layers later in time.",
        summary: `Offset selected layers by ${frames} frames.`,
        riskLevel: "low",
        assumptions: ["The active composition contains the layers you want to offset."],
        warnings: ["This changes layer start times, not the timing of existing keyframes."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        { type: "offset_selected_layers", frames },
      ],
    },
    source: "rules",
  };
}

function applyWiggleToSelectedPosition(): PlannedResponse {
  return {
    explanation: "The prompt is mapped to applying a deterministic position wiggle expression to whichever properties are selected in After Effects.",
    actionPlan: {
      ...basePlan({
        intent: "Apply a wiggle expression to the currently selected property.",
        summary: "Apply a subtle wiggle expression to the selected position property.",
        riskLevel: "medium",
        assumptions: ["A position property is selected on one or more layers in the active composition."],
        warnings: ["Any existing expression on the selected property will be replaced."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "apply_expression_to_selected_property",
          propertyName: "Position",
          expression: "wiggle(1.5, 20);",
        },
      ],
    },
    source: "rules",
  };
}

function convertSelectedLayersTo3d(): PlannedResponse {
  return {
    explanation: "This request maps to enabling the 3D switch on the currently selected layers.",
    actionPlan: {
      ...basePlan({
        intent: "Convert the selected layers to 3D layers.",
        summary: "Turn on 3D for the selected layers.",
        riskLevel: "low",
        assumptions: ["The layers you want to convert are currently selected."],
        warnings: ["The layers will begin rendering in 3D space after execution."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        { type: "convert_selected_layers_to_3d" },
      ],
    },
    source: "rules",
  };
}

function addCameraPush(context: AEContext): PlannedResponse {
  const width = context.activeComp?.width ?? 1920;
  const height = context.activeComp?.height ?? 1080;

  return {
    explanation: "The request maps to ensuring a camera exists and then animating a short push-in over the opening of the comp.",
    actionPlan: {
      ...basePlan({
        intent: "Create or reuse a camera and animate a subtle push-in.",
        summary: "Ensure a camera and animate a short push-in.",
        riskLevel: "medium",
        assumptions: ["The active composition is the one that should receive the camera move."],
        warnings: ["This will add or reuse a camera layer in the active composition."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "ensure_camera",
          name: "Motion Buddy Camera",
          position: [Math.round(width / 2), Math.round(height / 2), -1200],
          pointOfInterest: [Math.round(width / 2), Math.round(height / 2), 0],
          autoOrient: "none",
        },
        {
          type: "animate_camera_push",
          startTimeSeconds: 0,
          durationSeconds: 2,
          startZ: -1200,
          endZ: -600,
          easeInfluence: 65,
        },
      ],
    },
    source: "rules",
  };
}

function animateOvershootScale(): PlannedResponse {
  return {
    explanation: "The request maps to a standard overshoot scale animation on the selected layers.",
    actionPlan: {
      ...basePlan({
        intent: "Animate a short overshoot scale on the selected layers.",
        summary: "Apply a subtle overshoot scale animation to the selected layers.",
        riskLevel: "medium",
        assumptions: ["The layers you want to animate are selected in the active composition."],
        warnings: ["Existing scale keyframes at the same times may be overwritten."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "animate_overshoot_scale_on_selected_layers",
          startTimeSeconds: 0,
          durationSeconds: 0.65,
          introScale: 85,
          overshootScale: 108,
          settleScale: 100,
        },
      ],
    },
    source: "rules",
  };
}

function createShapeGrid(): PlannedResponse {
  return {
    explanation: "The request maps to building a centered deterministic shape grid with a fixed palette.",
    actionPlan: {
      ...basePlan({
        intent: "Create a regular grid of shape layers in the active composition.",
        summary: "Create a centered 4x4 shape grid.",
        riskLevel: "medium",
        assumptions: ["The active composition should receive new generated layers."],
        warnings: ["This will add sixteen new shape layers to the active composition."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "create_shape_grid",
          rows: 4,
          columns: 4,
          boxSize: 120,
          spacingX: 220,
          spacingY: 220,
          palette: defaultPalette(),
        },
      ],
    },
    source: "rules",
  };
}

function applyPalette(): PlannedResponse {
  return {
    explanation: "The request maps to a deterministic palette applied across the selected shape or text layers.",
    actionPlan: {
      ...basePlan({
        intent: "Apply a deterministic color palette to the selected compatible layers.",
        summary: "Apply a four-color palette to the selected layers.",
        riskLevel: "low",
        assumptions: ["Shape or text layers are selected in the active composition."],
        warnings: ["Non-shape and non-text layers will be skipped."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "apply_palette_to_selected_layers",
          palette: defaultPalette(),
          mode: "cycle",
        },
      ],
    },
    source: "rules",
  };
}

function ensureCameraOnly(context: AEContext): PlannedResponse {
  const width = context.activeComp?.width ?? 1920;
  const height = context.activeComp?.height ?? 1080;

  return {
    explanation: "The request maps to creating a camera if the active composition does not already have one.",
    actionPlan: {
      ...basePlan({
        intent: "Ensure a camera exists in the active composition.",
        summary: "Ensure a camera exists.",
        riskLevel: "low",
        assumptions: ["The active composition is the target for the new or existing camera."],
      }),
      actions: [
        { type: "ensure_active_comp" },
        {
          type: "ensure_camera",
          name: "Motion Buddy Camera",
          position: [Math.round(width / 2), Math.round(height / 2), -1200],
          pointOfInterest: [Math.round(width / 2), Math.round(height / 2), 0],
          autoOrient: "none",
        },
      ],
    },
    source: "rules",
  };
}

function fallbackPlan(prompt: string): PlannedResponse {
  return {
    explanation:
      "No local rule matched this prompt closely enough to produce a safe deterministic action plan. With an API key, Motion Buddy can still try to plan the request within the supported action types.",
    actionPlan: {
      ...basePlan({
        intent: "No supported offline action mapping was found.",
        summary: "No deterministic action plan could be produced from the prompt.",
        riskLevel: "high",
        warnings: [
          `The local fallback could not safely map: "${prompt}".`,
          "Add OPENAI_API_KEY for broader prompt understanding across the same supported action types.",
        ],
      }),
      actions: [],
    },
    source: "rules",
  };
}

export function generateWithRules(prompt: string, context: AEContext): PlannedResponse {
  const lower = prompt.toLowerCase();
  const frameRate = context.activeComp?.frameRate ?? 24;

  const offsetMatch = lower.match(/offset .*selected layers? by (-?\d+) frames?/);
  if (offsetMatch) {
    return offsetSelectedLayersByFrames(Number(offsetMatch[1]), frameRate);
  }

  if (lower.includes("wiggle") && lower.includes("position")) {
    return applyWiggleToSelectedPosition();
  }

  if (lower.includes("camera push") || lower.includes("push in") || lower.includes("push-in")) {
    return addCameraPush(context);
  }

  if (lower.includes("ensure camera") || lower.includes("add camera") || lower.includes("create camera")) {
    return ensureCameraOnly(context);
  }

  if (lower.includes("3d")) {
    return convertSelectedLayersTo3d();
  }

  if (lower.includes("overshoot") && lower.includes("scale")) {
    return animateOvershootScale();
  }

  if (lower.includes("grid") && lower.includes("shape")) {
    return createShapeGrid();
  }

  if (lower.includes("palette") || (lower.includes("color") && lower.includes("selected layers"))) {
    return applyPalette();
  }

  return fallbackPlan(prompt);
}
