import { buildGeneratedPlan, generatePlanWithPlanner } from "../../core/planner.js";
import type { AEContext, CommandStore, GeneratedPlan, PlannedResponse } from "../../shared/types.js";
import { resolveRegistryItemPlan, searchMotionRegistry } from "../commands/registry.js";

function createGeneratedResolution(prompt: string, title: string, confidence: number): GeneratedPlan["resolution"] {
  return {
    kind: "generated",
    title,
    matchedQuery: prompt,
    confidence,
  };
}

function resolveDeterministicMatch(params: {
  prompt: string;
  context: AEContext;
  store?: CommandStore | null;
}): { planned: PlannedResponse; resolution: GeneratedPlan["resolution"] } | null {
  const [bestMatch] = searchMotionRegistry({
    prompt: params.prompt,
    context: params.context,
    store: params.store,
    limit: 1,
  });

  if (!bestMatch) {
    return null;
  }

  const threshold = bestMatch.kind === "built-in-command" ? 0.72 : 0.6;
  if (bestMatch.score < threshold) {
    return null;
  }

  const planned = resolveRegistryItemPlan({
    itemId: bestMatch.id,
    context: params.context,
    prompt: params.prompt,
    store: params.store,
  });

  if (!planned) {
    return null;
  }

  return {
    planned,
    resolution: {
      kind: bestMatch.kind,
      id: bestMatch.id,
      title: bestMatch.title,
      matchedQuery: params.prompt,
      confidence: Number(bestMatch.score.toFixed(2)),
    },
  };
}

export async function resolveMotionRequest(params: {
  prompt: string;
  context: AEContext;
  store?: CommandStore | null;
  requestModelPlan?: () => Promise<PlannedResponse>;
}): Promise<GeneratedPlan> {
  const deterministic = resolveDeterministicMatch({
    prompt: params.prompt,
    context: params.context,
    store: params.store,
  });

  if (deterministic) {
    return buildGeneratedPlan({
      prompt: params.prompt,
      context: params.context,
      planned: deterministic.planned,
      resolution: deterministic.resolution,
    });
  }

  const generated = await generatePlanWithPlanner({
    prompt: params.prompt,
    context: params.context,
    requestModelPlan: params.requestModelPlan,
  });

  return {
    ...generated,
    resolution:
      generated.source === "openai"
        ? createGeneratedResolution(params.prompt, "LLM-assisted plan", 0.58)
        : createGeneratedResolution(params.prompt, "Rules fallback plan", 0.34),
  };
}
