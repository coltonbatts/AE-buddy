import type {
  AEContext,
  ActionPlan,
  ActionPlanAction,
  ActionType,
  PlannedResponse,
  PlanValidationResult,
  RgbColor,
  ValidationIssue,
} from "../types.js";
import { supportedActionTypes } from "./action-plan-schema.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRgbColor(value: unknown): value is RgbColor {
  return Array.isArray(value) && value.length === 3 && value.every((item) => isNumber(item));
}

function isRgbPalette(value: unknown): value is RgbColor[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isRgbColor(item));
}

function actionError(message: string, actionType?: ActionType): ValidationIssue {
  return { severity: "error", message, actionType };
}

function actionWarning(message: string, actionType?: ActionType): ValidationIssue {
  return { severity: "warning", message, actionType };
}

function validateActionShape(action: unknown, index: number): string[] {
  if (!isRecord(action)) {
    return [`Action ${index + 1} must be an object.`];
  }

  const type = action.type;
  if (typeof type !== "string" || !supportedActionTypes.includes(type as (typeof supportedActionTypes)[number])) {
    return [`Action ${index + 1} uses an unsupported type.`];
  }

  switch (type) {
    case "ensure_active_comp":
    case "convert_selected_layers_to_3d":
    case "center_anchor_point_on_selected_layers":
    case "trim_selected_layers_to_playhead":
    case "toggle_motion_blur_on_selected_layers":
      return [];
    case "offset_selected_layers":
      return isNumber(action.frames) ? [] : [`Action ${index + 1} requires a numeric frames value.`];
    case "apply_expression_to_selected_property":
      return typeof action.expression === "string" && action.expression.trim()
        ? []
        : [`Action ${index + 1} requires a non-empty expression string.`];
    case "animate_overshoot_scale_on_selected_layers":
      return [];
    case "ensure_camera":
      return [];
    case "animate_camera_push":
      return [];
    case "create_shape_grid":
      return action.palette === undefined || isRgbPalette(action.palette)
        ? []
        : [`Action ${index + 1} palette must be an array of RGB triplets.`];
    case "apply_palette_to_selected_layers":
      return isRgbPalette(action.palette) ? [] : [`Action ${index + 1} requires a non-empty RGB palette.`];
    case "parent_selected_layers_to_null":
      return action.nullName === undefined || typeof action.nullName === "string"
        ? []
        : [`Action ${index + 1} nullName must be a string when provided.`];
    case "precompose_selected_layers":
      return (action.name === undefined || typeof action.name === "string") &&
        (action.moveAllAttributes === undefined || typeof action.moveAllAttributes === "boolean")
        ? []
        : [`Action ${index + 1} precompose configuration is invalid.`];
    case "easy_ease_selected_keyframes":
      return action.easeInfluence === undefined || isNumber(action.easeInfluence)
        ? []
        : [`Action ${index + 1} easeInfluence must be numeric when provided.`];
    case "create_text_layer":
      return (action.text === undefined || typeof action.text === "string") &&
        (action.name === undefined || typeof action.name === "string")
        ? []
        : [`Action ${index + 1} create_text_layer fields must be strings when provided.`];
    default:
      return [`Action ${index + 1} uses an unsupported type.`];
  }
}

export function parseModelResponse(raw: unknown): { value?: PlannedResponse; errors: string[] } {
  if (!isRecord(raw)) {
    return { errors: ["Model response must be an object."] };
  }

  const explanation = raw.explanation;
  const actionPlan = raw.actionPlan;

  if (typeof explanation !== "string" || !explanation.trim()) {
    return { errors: ["Model response must include a non-empty explanation string."] };
  }

  const planResult = parseActionPlan(actionPlan);
  if (planResult.errors.length > 0 || !planResult.value) {
    return { errors: planResult.errors };
  }

  return {
    value: {
      explanation,
      actionPlan: planResult.value,
      source: "openai",
    },
    errors: [],
  };
}

export function parseActionPlan(raw: unknown): { value?: ActionPlan; errors: string[] } {
  if (!isRecord(raw)) {
    return { errors: ["Action plan must be an object."] };
  }

  const errors: string[] = [];

  if (raw.version !== "1.0") {
    errors.push('Action plan version must be "1.0".');
  }

  if (typeof raw.intent !== "string" || !raw.intent.trim()) {
    errors.push("Action plan intent must be a non-empty string.");
  }

  if (typeof raw.summary !== "string" || !raw.summary.trim()) {
    errors.push("Action plan summary must be a non-empty string.");
  }

  if (raw.riskLevel !== "low" && raw.riskLevel !== "medium" && raw.riskLevel !== "high") {
    errors.push('Action plan riskLevel must be "low", "medium", or "high".');
  }

  if (!isStringArray(raw.assumptions)) {
    errors.push("Action plan assumptions must be a string array.");
  }

  if (!isStringArray(raw.warnings)) {
    errors.push("Action plan warnings must be a string array.");
  }

  if (!Array.isArray(raw.actions)) {
    errors.push("Action plan actions must be an array.");
  } else {
    raw.actions.forEach((action, index) => {
      errors.push(...validateActionShape(action, index));
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: raw as unknown as ActionPlan,
    errors: [],
  };
}

function selectedLayerNames(context: AEContext) {
  return context.selectedLayers.map((layer) => layer.name);
}

function hasExpressionTarget(context: AEContext, propertyName?: string) {
  return context.selectedLayers.some((layer) =>
    layer.selectedProperties.some((selectedProperty) =>
      propertyName ? selectedProperty === propertyName : selectedProperty.length > 0,
    ),
  );
}

function hasLockedSelectedLayers(context: AEContext) {
  return context.selectedLayers.some((layer) => layer.locked);
}

export function validatePlanAgainstContext(plan: ActionPlan, context: AEContext): PlanValidationResult {
  const issues: ValidationIssue[] = [];
  const affectedTargets = new Set<string>();

  if (!plan.actions.length) {
    issues.push(actionWarning("The plan contains no executable actions."));
  }

  for (const action of plan.actions) {
    switch (action.type) {
      case "ensure_active_comp":
        if (!context.activeComp) {
          issues.push(actionError("No active composition is available.", action.type));
        }
        if (context.activeComp) {
          affectedTargets.add(`comp:${context.activeComp.name}`);
        }
        break;
      case "offset_selected_layers":
      case "convert_selected_layers_to_3d":
      case "animate_overshoot_scale_on_selected_layers":
      case "parent_selected_layers_to_null":
      case "trim_selected_layers_to_playhead":
      case "toggle_motion_blur_on_selected_layers":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select one or more layers before execution.", action.type));
        }
        if (hasLockedSelectedLayers(context)) {
          issues.push(actionError("Unlock the selected layers before execution.", action.type));
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
      case "center_anchor_point_on_selected_layers":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select one or more layers before execution.", action.type));
        }
        if (hasLockedSelectedLayers(context)) {
          issues.push(actionError("Unlock the selected layers before execution.", action.type));
        }
        if (
          context.selectedLayers.length > 0 &&
          context.selectedLayers.every(
            (layer) => layer.type === "camera" || layer.type === "light" || layer.type === "null",
          )
        ) {
          issues.push(actionError("The selected layers do not support deterministic anchor centering.", action.type));
        }
        if (context.selectedLayers.some((layer) => layer.parentName || layer.threeD)) {
          issues.push(
            actionWarning(
              "Parented or 3D layers may shift slightly during anchor centering because compensation is applied in layer space.",
              action.type,
            ),
          );
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
      case "apply_expression_to_selected_property":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select at least one layer with a property selected.", action.type));
        } else if (!hasExpressionTarget(context, action.propertyName)) {
          issues.push(
            actionError(
              action.propertyName
                ? `No selected property named "${action.propertyName}" was found on the selected layers.`
                : "No selected properties were exported from After Effects.",
              action.type,
            ),
          );
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
      case "easy_ease_selected_keyframes":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select one or more layers before execution.", action.type));
        }
        if (hasLockedSelectedLayers(context)) {
          issues.push(actionError("Unlock the selected layers before applying Easy Ease.", action.type));
        }
        if (!context.selectedLayers.some((layer) => layer.selectedKeyframeCount > 0)) {
          issues.push(actionError("Select one or more keyframes before applying Easy Ease.", action.type));
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
      case "ensure_camera":
      case "animate_camera_push":
      case "create_shape_grid":
      case "create_text_layer":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (context.activeComp) {
          affectedTargets.add(`comp:${context.activeComp.name}`);
        }
        if (action.type === "animate_camera_push" && !context.activeComp?.hasCamera) {
          const hasEnsureCamera = plan.actions.some((candidate) => candidate.type === "ensure_camera");
          if (!hasEnsureCamera) {
            issues.push(
              actionWarning(
                "No camera is present in the exported context. Add ensure_camera before animate_camera_push for predictable execution.",
                action.type,
              ),
            );
          }
        }
        break;
      case "precompose_selected_layers":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select one or more layers before precomposing.", action.type));
        }
        if (hasLockedSelectedLayers(context)) {
          issues.push(actionError("Unlock the selected layers before precomposing.", action.type));
        }
        if (
          context.selectedLayers.some(
            (layer) =>
              layer.parentName &&
              !context.selectedLayers.some((candidate) => candidate.name === layer.parentName),
          )
        ) {
          issues.push(
            actionWarning(
              "Some selected layers have parents outside the selection, so precomposing may change inherited transforms.",
              action.type,
            ),
          );
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
      case "apply_palette_to_selected_layers":
        if (!context.activeComp) {
          issues.push(actionError("An active composition is required.", action.type));
        }
        if (!context.selectedLayers.length) {
          issues.push(actionError("Select shape or text layers before applying a palette.", action.type));
        }
        if (
          context.selectedLayers.length > 0 &&
          context.selectedLayers.every((layer) => layer.type !== "shape" && layer.type !== "text")
        ) {
          issues.push(
            actionWarning(
              "The selected layers are not shape or text layers, so palette application may have no visible effect.",
              action.type,
            ),
          );
        }
        selectedLayerNames(context).forEach((name) => affectedTargets.add(`layer:${name}`));
        break;
    }
  }

  if (context.notes.length > 0) {
    context.notes.forEach((note) => {
      issues.push(actionWarning(note));
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
    affectedTargets: Array.from(affectedTargets),
  };
}

export function describeValidation(result: PlanValidationResult) {
  if (result.issues.length === 0) {
    return "No validation issues.";
  }

  return result.issues
    .map((issue) => `${issue.severity.toUpperCase()}: ${issue.message}${issue.actionType ? ` [${issue.actionType}]` : ""}`)
    .join("\n");
}

export function affectedTargetsLabel(result: PlanValidationResult) {
  return result.affectedTargets.length > 0 ? result.affectedTargets.join(", ") : "No explicit targets detected.";
}

export function formatAction(action: ActionPlanAction) {
  switch (action.type) {
    case "ensure_active_comp":
      return "ensure_active_comp";
    case "offset_selected_layers":
      return `offset_selected_layers(frames=${action.frames})`;
    case "convert_selected_layers_to_3d":
      return "convert_selected_layers_to_3d";
    case "apply_expression_to_selected_property":
      return `apply_expression_to_selected_property(${action.propertyName ?? "selected"}, expression="${action.expression}")`;
    case "animate_overshoot_scale_on_selected_layers":
      return "animate_overshoot_scale_on_selected_layers";
    case "ensure_camera":
      return `ensure_camera(${action.name ?? "Motion Buddy Camera"})`;
    case "animate_camera_push":
      return "animate_camera_push";
    case "create_shape_grid":
      return `create_shape_grid(${action.columns ?? 4}x${action.rows ?? 4})`;
    case "apply_palette_to_selected_layers":
      return `apply_palette_to_selected_layers(colors=${action.palette.length})`;
    case "center_anchor_point_on_selected_layers":
      return "center_anchor_point_on_selected_layers";
    case "parent_selected_layers_to_null":
      return `parent_selected_layers_to_null(${action.nullName ?? "AE Buddy Null"})`;
    case "trim_selected_layers_to_playhead":
      return "trim_selected_layers_to_playhead";
    case "precompose_selected_layers":
      return `precompose_selected_layers(${action.name ?? "AE Buddy Precomp"})`;
    case "easy_ease_selected_keyframes":
      return `easy_ease_selected_keyframes(${action.easeInfluence ?? 70})`;
    case "toggle_motion_blur_on_selected_layers":
      return "toggle_motion_blur_on_selected_layers";
    case "create_text_layer":
      return `create_text_layer(${action.text ?? "New Text"})`;
  }
}
