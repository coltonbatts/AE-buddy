import { generatePlan } from "../core/generator.js";
import type { ExecutionResult, LoggedRun } from "../shared/types.js";
import type { EngineHost, PreparedRun } from "./contracts.js";

export async function prepareRun(params: {
  host: EngineHost;
  prompt: string;
  model?: string;
  apiKey?: string;
}): Promise<PreparedRun> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error("No motion request supplied.");
  }

  await params.host.ensureWorkspace();
  const context = await params.host.loadContext();
  const generatedPlan = await generatePlan({
    prompt,
    context,
    model: params.model ?? params.host.config.model,
    apiKey: params.apiKey ?? params.host.config.openAiApiKey,
  });

  const logPath = await params.host.createRunLog({
    prompt,
    generatedPlan,
    context,
  });

  return {
    prompt,
    context,
    generatedPlan,
    logPath,
  };
}

export async function commitPreparedRun(params: {
  host: EngineHost;
  run: PreparedRun;
}): Promise<void> {
  await params.host.ensureWorkspace();
  await params.host.writeExecutionBundle({
    generatedPlan: params.run.generatedPlan,
    context: params.run.context,
  });
}

export async function readExecutionFeedback(params: {
  host: EngineHost;
  run: PreparedRun;
}): Promise<ExecutionResult | null> {
  const result = await params.host.readExecutionResult();
  await params.host.finalizeRunLog(params.run.logPath, result);
  return result;
}

export async function loadRunHistory(host: EngineHost): Promise<LoggedRun[]> {
  return host.listRunLogs();
}
