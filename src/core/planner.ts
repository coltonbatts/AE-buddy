import type { AEContext, GeneratedPlan, PlannedResponse } from "../types.js";
import { renderActionPlan } from "./action-plan-renderer.js";
import { validatePlanAgainstContext } from "./action-plan-validator.js";
import { generateWithRules } from "./rules.js";

export function buildGeneratedPlan(params: {
  prompt: string;
  context: AEContext;
  planned: PlannedResponse;
  resolution?: GeneratedPlan["resolution"];
}): GeneratedPlan {
  const validation = validatePlanAgainstContext(params.planned.actionPlan, params.context);
  const resolution =
    params.resolution ??
    ({
      kind: "generated",
      title: params.planned.source === "openai" ? "LLM-assisted plan" : "Rules fallback plan",
      matchedQuery: params.prompt,
      confidence: params.planned.source === "openai" ? 0.58 : 0.34,
    } satisfies GeneratedPlan["resolution"]);

  return {
    prompt: params.prompt,
    explanation: params.planned.explanation,
    actionPlan: params.planned.actionPlan,
    validation,
    renderedScript: renderActionPlan(params.planned.actionPlan, params.context),
    source: params.planned.source,
    resolution,
  };
}

export async function generatePlanWithPlanner(params: {
  prompt: string;
  context: AEContext;
  requestModelPlan?: () => Promise<PlannedResponse>;
}): Promise<GeneratedPlan> {
  if (params.requestModelPlan) {
    try {
      const planned = await params.requestModelPlan();
      return buildGeneratedPlan({
        prompt: params.prompt,
        context: params.context,
        planned,
      });
    } catch (error) {
      const fallback = generateWithRules(params.prompt, params.context);
      fallback.actionPlan.warnings.unshift(
        `OpenAI planning failed and Motion Buddy fell back to local rules: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return buildGeneratedPlan({
        prompt: params.prompt,
        context: params.context,
        planned: fallback,
      });
    }
  }

  return buildGeneratedPlan({
    prompt: params.prompt,
    context: params.context,
    planned: generateWithRules(params.prompt, params.context),
  });
}
