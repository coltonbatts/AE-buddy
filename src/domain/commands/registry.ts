import type {
  ActionPlan,
  AEContext,
  CommandStore,
  PlannedResponse,
  SavedRecipeRecord,
} from "../../shared/types.js";
import { createAeContextModel, type AEContextModel } from "../context/context-model.js";

export type RegistryItemKind = "built-in-command" | "recipe" | "saved-recipe";

export interface RegistryBuildParams {
  prompt: string;
  context: AEContext;
  contextModel: AEContextModel;
}

export interface RegistryDefinition {
  id: string;
  kind: Exclude<RegistryItemKind, "saved-recipe">;
  title: string;
  description: string;
  aliases: string[];
  keywords: string[];
  category: string;
  buildPlan: (params: RegistryBuildParams) => PlannedResponse;
  availability?: (context: AEContextModel) => { available: boolean; reason?: string };
}

export interface RegistrySearchResult {
  id: string;
  kind: RegistryItemKind;
  title: string;
  description: string;
  category: string;
  aliases: string[];
  score: number;
  usageCount: number;
  favorite: boolean;
  available: boolean;
  unavailableReason?: string;
  savedRecipe?: SavedRecipeRecord;
}

function basePlan(params: {
  intent: string;
  summary: string;
  riskLevel: ActionPlan["riskLevel"];
  assumptions?: string[];
  warnings?: string[];
  actions?: ActionPlan["actions"];
}): ActionPlan {
  return {
    version: "1.0",
    intent: params.intent,
    summary: params.summary,
    riskLevel: params.riskLevel,
    assumptions: params.assumptions ?? [],
    warnings: params.warnings ?? [],
    actions: params.actions ?? [],
  };
}

function registryResponse(
  params: Omit<RegistryBuildParams, "contextModel"> & {
    explanation: string;
    actionPlan: ActionPlan;
  },
): PlannedResponse {
  return {
    explanation: params.explanation,
    actionPlan: params.actionPlan,
    source: "registry",
  };
}

function extractQuotedValue(prompt: string) {
  const match = prompt.match(/["“](.+?)["”]/);
  return match?.[1]?.trim() || null;
}

const builtInCommands: RegistryDefinition[] = [
  {
    id: "center-anchor-point",
    kind: "built-in-command",
    title: "Center Anchor Point",
    description: "Center the anchor point on each selected layer while preserving its position.",
    aliases: ["center anchor", "anchor", "center anchor point"],
    keywords: ["anchor", "center", "pivot", "layer"],
    category: "Layer",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command deterministically centers anchor points for the selected layers without invoking generation.",
        actionPlan: basePlan({
          intent: "Center the anchor points of the selected layers.",
          summary: "Center anchor points for the selected layers.",
          riskLevel: "low",
          assumptions: ["The current selection is the intended target."],
          warnings: ["Layers without a measurable source rectangle may be left unchanged."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "center_anchor_point_on_selected_layers" },
          ],
        }),
      }),
  },
  {
    id: "parent-to-null",
    kind: "built-in-command",
    title: "Parent To Null",
    description: "Create a new null and parent the current selection to it.",
    aliases: ["parent", "null", "parent to null"],
    keywords: ["parent", "null", "controller", "rig"],
    category: "Layer",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command creates a fresh null and parents the selected layers to it.",
        actionPlan: basePlan({
          intent: "Create a new null and parent the selected layers to it.",
          summary: "Parent the selected layers to a new null.",
          riskLevel: "medium",
          assumptions: ["The selected layers should move under a shared null controller."],
          warnings: ["This changes layer parenting and may affect inherited transforms."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "parent_selected_layers_to_null", nullName: "AE Buddy Null" },
          ],
        }),
      }),
  },
  {
    id: "trim-layer-to-playhead",
    kind: "built-in-command",
    title: "Trim Layer To Playhead",
    description: "Trim selected layer out points to the current playhead time.",
    aliases: ["trim", "trim layer", "trim to playhead"],
    keywords: ["trim", "playhead", "timeline", "out point"],
    category: "Timeline",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command trims the selected layers' out points to the exported playhead time.",
        actionPlan: basePlan({
          intent: "Trim selected layers so they end at the playhead.",
          summary: "Trim selected layers to the playhead.",
          riskLevel: "medium",
          assumptions: ["The exported playhead time is the intended trim point."],
          warnings: ["This trims out points only and can shorten layers immediately."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "trim_selected_layers_to_playhead" },
          ],
        }),
      }),
  },
  {
    id: "precompose-selection",
    kind: "built-in-command",
    title: "Precompose Selection",
    description: "Precompose the selected layers into a new composition.",
    aliases: ["precompose", "precomp", "precompose selection"],
    keywords: ["precompose", "precomp", "nest", "comp"],
    category: "Comp",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command precomposes the current selection using a deterministic precomp name.",
        actionPlan: basePlan({
          intent: "Precompose the selected layers into a new composition.",
          summary: "Precompose the selected layers.",
          riskLevel: "medium",
          assumptions: ["The selected layers belong together in a nested composition."],
          warnings: ["This changes the timeline structure and nesting."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "precompose_selected_layers", name: "AE Buddy Precomp", moveAllAttributes: true },
          ],
        }),
      }),
  },
  {
    id: "easy-ease-selected-keyframes",
    kind: "built-in-command",
    title: "Easy Ease Selected Keyframes",
    description: "Apply Easy Ease to selected keyframes on the current selection.",
    aliases: ["easy ease", "ease", "easy ease keyframes"],
    keywords: ["ease", "keyframes", "interpolation", "timing"],
    category: "Animation",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0 && context.hasSelectedKeyframes,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : !context.hasSelectedKeyframes
            ? "Select one or more keyframes first."
            : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command applies deterministic Easy Ease settings to the selected keyframes.",
        actionPlan: basePlan({
          intent: "Apply Easy Ease to the selected keyframes.",
          summary: "Apply Easy Ease to selected keyframes.",
          riskLevel: "low",
          assumptions: ["The exported selection includes the keyframes that should be eased."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "easy_ease_selected_keyframes", easeInfluence: 70 },
          ],
        }),
      }),
  },
  {
    id: "toggle-motion-blur",
    kind: "built-in-command",
    title: "Toggle Motion Blur",
    description: "Toggle motion blur on the selected layers and enable comp motion blur if needed.",
    aliases: ["motion blur", "toggle blur", "blur"],
    keywords: ["motion blur", "blur", "render"],
    category: "Layer",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command toggles motion blur across the current selection without using generation.",
        actionPlan: basePlan({
          intent: "Toggle motion blur on the selected layers.",
          summary: "Toggle motion blur on the selected layers.",
          riskLevel: "low",
          assumptions: ["The selected layers are the intended blur targets."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "toggle_motion_blur_on_selected_layers" },
          ],
        }),
      }),
  },
  {
    id: "create-text-layer",
    kind: "built-in-command",
    title: "Create Text Layer",
    description: "Create a new centered text layer in the active composition.",
    aliases: ["text", "create text", "text layer"],
    keywords: ["text", "title", "type", "layer"],
    category: "Generate",
    availability: (context) => ({
      available: context.hasActiveComp,
      reason: context.hasActiveComp ? undefined : "Open a composition first.",
    }),
    buildPlan: ({ contextModel, prompt }) => {
      const quotedText = extractQuotedValue(prompt) ?? "New Text";

      return registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command creates a deterministic centered text layer. Quoted text in the palette prompt is used when present.",
        actionPlan: basePlan({
          intent: "Create a new text layer in the active composition.",
          summary: "Create a text layer.",
          riskLevel: "low",
          assumptions: quotedText === "New Text" ? ["No explicit text was provided, so a default label is used."] : [],
          actions: [
            { type: "ensure_active_comp" },
            { type: "create_text_layer", text: quotedText, name: "AE Buddy Text" },
          ],
        }),
      });
    },
  },
  {
    id: "offset-selected-layers",
    kind: "built-in-command",
    title: "Offset Selected Layers",
    description: "Move the current selection later in time with a deterministic frame offset.",
    aliases: ["offset layers", "stagger layers", "offset selected layers"],
    keywords: ["timeline", "frames", "stagger", "delay"],
    category: "Timeline",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This resolves to a deterministic layer offset using the current composition frame rate.",
        actionPlan: basePlan({
          intent: "Offset the selected layers later in time.",
          summary: "Offset selected layers by 5 frames.",
          riskLevel: "low",
          assumptions: ["The currently selected layers are the intended target."],
          warnings: ["This changes layer start times rather than retiming individual keyframes."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "offset_selected_layers", frames: 5 },
          ],
        }),
      }),
  },
  {
    id: "convert-selection-to-3d",
    kind: "built-in-command",
    title: "Convert Selection To 3D",
    description: "Enable the 3D switch on the selected layers.",
    aliases: ["make layers 3d", "convert to 3d", "3d selected layers"],
    keywords: ["3d", "space", "layers"],
    category: "Layer",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This request maps cleanly to enabling 3D on the current selection.",
        actionPlan: basePlan({
          intent: "Convert the selected layers to 3D layers.",
          summary: "Turn on 3D for the selected layers.",
          riskLevel: "low",
          assumptions: ["The intended layers are currently selected."],
          warnings: ["The layers will begin rendering in 3D space after execution."],
          actions: [
            { type: "ensure_active_comp" },
            { type: "convert_selected_layers_to_3d" },
          ],
        }),
      }),
  },
  {
    id: "wiggle-position",
    kind: "built-in-command",
    title: "Wiggle Position",
    description: "Apply a deterministic wiggle expression to selected Position properties.",
    aliases: ["wiggle position", "position wiggle", "apply wiggle"],
    keywords: ["expression", "position", "wiggle"],
    category: "Property",
    availability: (context) => ({
      available: context.hasActiveComp && context.hasSelectedProperties,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : !context.hasSelectedProperties
          ? "Select a property in After Effects first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This built-in command applies a fixed position wiggle expression with deterministic parameters.",
        actionPlan: basePlan({
          intent: "Apply a wiggle expression to the selected position property.",
          summary: "Apply a subtle wiggle expression to Position.",
          riskLevel: "medium",
          assumptions: ["A Position property is selected on at least one selected layer."],
          warnings: ["Any existing expression on the selected property will be replaced."],
          actions: [
            { type: "ensure_active_comp" },
            {
              type: "apply_expression_to_selected_property",
              propertyName: "Position",
              expression: "wiggle(1.5, 20);",
            },
          ],
        }),
      }),
  },
  {
    id: "overshoot-scale",
    kind: "built-in-command",
    title: "Overshoot Scale",
    description: "Apply a short overshoot scale animation to the current selection.",
    aliases: ["pop scale", "overshoot scale", "scale pop"],
    keywords: ["animation", "scale", "overshoot", "pop"],
    category: "Animation",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command maps to the existing deterministic overshoot scale animation.",
        actionPlan: basePlan({
          intent: "Animate a short overshoot scale on the selected layers.",
          summary: "Apply an overshoot scale animation.",
          riskLevel: "medium",
          assumptions: ["The layers you want to animate are selected."],
          warnings: ["Existing scale keyframes at the same times may be overwritten."],
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
        }),
      }),
  },
  {
    id: "ensure-camera",
    kind: "built-in-command",
    title: "Ensure Camera",
    description: "Create or reuse a camera in the active composition.",
    aliases: ["add camera", "create camera", "ensure camera"],
    keywords: ["camera", "comp", "scene"],
    category: "Camera",
    availability: (context) => ({
      available: context.hasActiveComp,
      reason: context.hasActiveComp ? undefined : "Open a composition first.",
    }),
    buildPlan: ({ contextModel, prompt }) => {
      const width = contextModel.raw.activeComp?.width ?? 1920;
      const height = contextModel.raw.activeComp?.height ?? 1080;

      return registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command deterministically ensures that the active composition has a camera.",
        actionPlan: basePlan({
          intent: "Ensure a camera exists in the active composition.",
          summary: "Ensure a camera exists.",
          riskLevel: "low",
          assumptions: ["The active composition is the correct target."],
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
        }),
      });
    },
  },
  {
    id: "create-shape-grid",
    kind: "built-in-command",
    title: "Create Shape Grid",
    description: "Generate a centered shape grid with a deterministic palette.",
    aliases: ["shape grid", "grid of shapes", "create grid"],
    keywords: ["grid", "shapes", "layout", "pattern"],
    category: "Generate",
    availability: (context) => ({
      available: context.hasActiveComp,
      reason: context.hasActiveComp ? undefined : "Open a composition first.",
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This command builds a centered 4x4 shape grid using the existing deterministic renderer.",
        actionPlan: basePlan({
          intent: "Create a regular grid of shape layers in the active composition.",
          summary: "Create a centered 4x4 shape grid.",
          riskLevel: "medium",
          assumptions: ["The active composition should receive new generated layers."],
          warnings: ["This will add sixteen new shape layers to the active composition."],
          actions: [
            { type: "ensure_active_comp" },
            {
              type: "create_shape_grid",
              rows: 4,
              columns: 4,
              boxSize: 120,
              spacingX: 220,
              spacingY: 220,
            },
          ],
        }),
      }),
  },
  {
    id: "apply-palette",
    kind: "built-in-command",
    title: "Apply Palette",
    description: "Cycle a deterministic palette across the current text or shape selection.",
    aliases: ["apply palette", "color selected layers", "apply colors"],
    keywords: ["palette", "color", "shape", "text"],
    category: "Color",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This built-in command applies a fixed four-color palette across compatible selected layers.",
        actionPlan: basePlan({
          intent: "Apply a deterministic palette to the selected compatible layers.",
          summary: "Apply a four-color palette to the selected layers.",
          riskLevel: "low",
          assumptions: ["Text or shape layers are selected."],
          warnings: ["Non-shape and non-text layers will be skipped."],
          actions: [
            { type: "ensure_active_comp" },
            {
              type: "apply_palette_to_selected_layers",
              palette: [
                [0.9608, 0.3294, 0.298],
                [0.9961, 0.7725, 0.2314],
                [0.1765, 0.6745, 0.6431],
                [0.149, 0.3529, 0.7216],
              ],
              mode: "cycle",
            },
          ],
        }),
      }),
  },
];

const builtInRecipes: RegistryDefinition[] = [
  {
    id: "camera-push-in",
    kind: "recipe",
    title: "Camera Push In",
    description: "Ensure a camera exists, then apply a short push-in move.",
    aliases: ["camera push", "push in", "push-in"],
    keywords: ["camera", "push", "move", "recipe"],
    category: "Recipe",
    availability: (context) => ({
      available: context.hasActiveComp,
      reason: context.hasActiveComp ? undefined : "Open a composition first.",
    }),
    buildPlan: ({ contextModel, prompt }) => {
      const width = contextModel.raw.activeComp?.width ?? 1920;
      const height = contextModel.raw.activeComp?.height ?? 1080;

      return registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This recipe deterministically ensures a camera, then animates a short push-in over the opening of the composition.",
        actionPlan: basePlan({
          intent: "Create or reuse a camera and animate a subtle push-in.",
          summary: "Ensure a camera and animate a short push-in.",
          riskLevel: "medium",
          assumptions: ["The active composition is the intended target."],
          warnings: ["This will add or reuse a camera layer in the active composition."],
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
        }),
      });
    },
  },
  {
    id: "title-pop-color",
    kind: "recipe",
    title: "Title Pop Color",
    description: "Add an overshoot scale and palette treatment to selected text or shape layers.",
    aliases: ["title pop", "hero title", "pop title"],
    keywords: ["title", "pop", "overshoot", "palette", "recipe"],
    category: "Recipe",
    availability: (context) => ({
      available: context.hasActiveComp && context.selectedLayerCount > 0,
      reason: !context.hasActiveComp
        ? "Open a composition first."
        : context.selectedLayerCount === 0
          ? "Select one or more layers first."
          : undefined,
    }),
    buildPlan: ({ contextModel, prompt }) =>
      registryResponse({
        prompt,
        context: contextModel.raw,
        explanation: "This recipe layers deterministic overshoot scale animation with the fixed palette command.",
        actionPlan: basePlan({
          intent: "Create a punchy title treatment for the current selection.",
          summary: "Apply a title pop recipe to the selected layers.",
          riskLevel: "medium",
          assumptions: ["The selected layers are the intended title or hero layers."],
          warnings: ["Existing scale keyframes at the same times may be overwritten."],
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
            {
              type: "apply_palette_to_selected_layers",
              palette: [
                [0.9608, 0.3294, 0.298],
                [0.9961, 0.7725, 0.2314],
                [0.1765, 0.6745, 0.6431],
                [0.149, 0.3529, 0.7216],
              ],
              mode: "cycle",
            },
          ],
        }),
      }),
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreTextMatch(query: string, haystacks: string[]) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let bestScore = 0;

  for (const rawHaystack of haystacks) {
    const haystack = normalizeText(rawHaystack);
    if (!haystack) {
      continue;
    }

    if (haystack === normalizedQuery) {
      bestScore = Math.max(bestScore, 1);
      continue;
    }

    if (haystack.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 0.94);
      continue;
    }

    if (haystack.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 0.86);
    }

    const matchedTokens = queryTokens.filter((token) => haystack.includes(token)).length;
    if (matchedTokens > 0) {
      bestScore = Math.max(bestScore, matchedTokens / queryTokens.length * 0.78);
    }
  }

  return bestScore;
}

function kindPriority(kind: RegistryItemKind) {
  switch (kind) {
    case "built-in-command":
      return 0;
    case "recipe":
      return 1;
    case "saved-recipe":
      return 2;
  }
}

function mapSavedRecipe(recipe: SavedRecipeRecord): RegistrySearchResult {
  return {
    id: recipe.id,
    kind: "saved-recipe",
    title: recipe.title,
    description: recipe.description,
    category: "Saved Recipe",
    aliases: recipe.keywords,
    score: 0,
    usageCount: 0,
    favorite: false,
    available: true,
    savedRecipe: recipe,
  };
}

function scoreResult(
  result: RegistrySearchResult,
  prompt: string,
  contextModel: AEContextModel,
  favoriteIds: string[],
  usageCounts: Record<string, number>,
): RegistrySearchResult {
  if (result.kind !== "saved-recipe") {
    const definition = getMotionRegistry().find((entry) => entry.id === result.id);
    const availabilityResult = definition?.availability?.(contextModel) ?? { available: true };
    const primaryScore = scoreTextMatch(prompt, [result.title, ...result.aliases, result.description]);
    const keywordScore = scoreTextMatch(prompt, definition?.keywords ?? []) * 0.72;
    return {
      ...result,
      score: Math.max(primaryScore, keywordScore),
      usageCount: usageCounts[result.id] ?? usageCounts[result.title] ?? 0,
      favorite: favoriteIds.includes(result.id),
      available: availabilityResult.available,
      unavailableReason: availabilityResult.reason,
    };
  }

  return {
    ...result,
    score: scoreTextMatch(prompt, [result.title, ...result.aliases, result.description]),
    usageCount: usageCounts[result.id] ?? 0,
    favorite: favoriteIds.includes(result.id),
    available: true,
  };
}

export function getMotionRegistry() {
  return [...builtInCommands, ...builtInRecipes];
}

export function getBuiltInCommands() {
  return builtInCommands;
}

export function getBuiltInRecipes() {
  return builtInRecipes;
}

export function searchMotionRegistry(params: {
  prompt: string;
  context: AEContext;
  store?: CommandStore | null;
  limit?: number;
}): RegistrySearchResult[] {
  const contextModel = createAeContextModel(params.context);
  const favoriteIds = params.store?.favoriteIds ?? [];
  const usageCounts = Object.fromEntries((params.store?.usageStats ?? []).map((entry) => [entry.entityId, entry.count]));
  const results = [
    ...getMotionRegistry().map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      description: entry.description,
      category: entry.category,
      aliases: entry.aliases,
      score: 0,
      usageCount: 0,
      favorite: false,
      available: true,
    }) satisfies RegistrySearchResult),
    ...(params.store?.savedRecipes ?? []).map(mapSavedRecipe),
  ]
    .map((result) => scoreResult(result, params.prompt, contextModel, favoriteIds, usageCounts))
    .filter((result) =>
      params.prompt.trim()
        ? result.score > 0.24
        : result.favorite || result.kind === "saved-recipe" || result.usageCount > 0,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.available) - Number(left.available) ||
        Number(right.favorite) - Number(left.favorite) ||
        right.usageCount - left.usageCount ||
        kindPriority(left.kind) - kindPriority(right.kind) ||
        left.title.localeCompare(right.title),
    );

  return results.slice(0, params.limit ?? 8);
}

export function resolveRegistryItemPlan(params: {
  itemId: string;
  context: AEContext;
  prompt: string;
  store?: CommandStore | null;
}): PlannedResponse | null {
  const contextModel = createAeContextModel(params.context);
  const definition = getMotionRegistry().find((entry) => entry.id === params.itemId);
  if (definition) {
    return definition.buildPlan({
      prompt: params.prompt,
      context: params.context,
      contextModel,
    });
  }

  const savedRecipe = params.store?.savedRecipes.find((entry) => entry.id === params.itemId);
  if (!savedRecipe) {
    return null;
  }

  return {
    explanation: `This saved recipe replays the locally stored action plan "${savedRecipe.title}".`,
    actionPlan: savedRecipe.actionPlan,
    source: savedRecipe.source,
  };
}
