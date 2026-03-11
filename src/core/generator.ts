import type { AEContext, GeneratedPlan } from "../types.js";
import { generateWithOpenAi } from "./openai-generator.js";
import { generatePlanWithPlanner } from "./planner.js";

export async function generatePlan(params: {
  prompt: string;
  context: AEContext;
  model: string;
  apiKey: string;
}): Promise<GeneratedPlan> {
  return generatePlanWithPlanner({
    prompt: params.prompt,
    context: params.context,
    requestModelPlan: params.apiKey
      ? () =>
          generateWithOpenAi({
            apiKey: params.apiKey,
            model: params.model,
            prompt: params.prompt,
            context: params.context,
          })
      : undefined,
  });
}
