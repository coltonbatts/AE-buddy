export const supportedActionTypes = [
  "ensure_active_comp",
  "offset_selected_layers",
  "convert_selected_layers_to_3d",
  "apply_expression_to_selected_property",
  "animate_overshoot_scale_on_selected_layers",
  "ensure_camera",
  "animate_camera_push",
  "create_shape_grid",
  "apply_palette_to_selected_layers",
  "center_anchor_point_on_selected_layers",
  "parent_selected_layers_to_null",
  "trim_selected_layers_to_playhead",
  "precompose_selected_layers",
  "easy_ease_selected_keyframes",
  "toggle_motion_blur_on_selected_layers",
  "create_text_layer",
] as const;

export const actionPlanJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "MotionBuddyActionPlan",
  type: "object",
  additionalProperties: false,
  required: ["version", "intent", "summary", "riskLevel", "assumptions", "actions", "warnings"],
  properties: {
    version: { const: "1.0" },
    intent: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    riskLevel: { enum: ["low", "medium", "high"] },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    actions: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "ensure_active_comp" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "frames"],
            properties: {
              type: { const: "offset_selected_layers" },
              frames: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "convert_selected_layers_to_3d" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "expression"],
            properties: {
              type: { const: "apply_expression_to_selected_property" },
              expression: { type: "string", minLength: 1 },
              propertyName: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "animate_overshoot_scale_on_selected_layers" },
              startTimeSeconds: { type: "number" },
              durationSeconds: { type: "number" },
              introScale: { type: "number" },
              overshootScale: { type: "number" },
              settleScale: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "ensure_camera" },
              name: { type: "string" },
              position: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3,
              },
              pointOfInterest: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3,
              },
              autoOrient: { enum: ["none", "towards_point_of_interest"] },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "animate_camera_push" },
              startTimeSeconds: { type: "number" },
              durationSeconds: { type: "number" },
              startZ: { type: "number" },
              endZ: { type: "number" },
              easeInfluence: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "create_shape_grid" },
              rows: { type: "number" },
              columns: { type: "number" },
              boxSize: { type: "number" },
              spacingX: { type: "number" },
              spacingY: { type: "number" },
              palette: {
                type: "array",
                items: {
                  type: "array",
                  items: { type: "number" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "palette"],
            properties: {
              type: { const: "apply_palette_to_selected_layers" },
              palette: {
                type: "array",
                minItems: 1,
                items: {
                  type: "array",
                  items: { type: "number" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              mode: { const: "cycle" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "center_anchor_point_on_selected_layers" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "parent_selected_layers_to_null" },
              nullName: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "trim_selected_layers_to_playhead" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "precompose_selected_layers" },
              name: { type: "string" },
              moveAllAttributes: { type: "boolean" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "easy_ease_selected_keyframes" },
              easeInfluence: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "toggle_motion_blur_on_selected_layers" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: { const: "create_text_layer" },
              text: { type: "string" },
              name: { type: "string" },
            },
          },
        ],
      },
    },
  },
} as const;

export const modelResponseJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "MotionBuddyModelResponse",
  type: "object",
  additionalProperties: false,
  required: ["explanation", "actionPlan"],
  properties: {
    explanation: { type: "string", minLength: 1 },
    actionPlan: actionPlanJsonSchema,
  },
} as const;
