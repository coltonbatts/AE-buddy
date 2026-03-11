import { createRunId } from "../shared/run-files.js";
import type { CommandStore, ExecutionFeedbackReadResult, LoggedRun } from "../shared/types.js";
import type { EngineHost, PreparedRun } from "./contracts.js";

export async function prepareRun(params: {
  host: EngineHost;
  prompt: string;
  model?: string;
  store?: CommandStore | null;
}): Promise<PreparedRun> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error("No motion request supplied.");
  }

  await params.host.ensureWorkspace();
  const context = await params.host.loadContext();
  const runId = createRunId();
  const generatedPlan = await params.host.generatePlan({
    prompt,
    context,
    model: params.model ?? params.host.config.model,
    store: params.store,
  });

  const logPath = await params.host.createRunLog({
    runId,
    prompt,
    generatedPlan,
    context,
  });

  return {
    runId,
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
    runId: params.run.runId,
    generatedPlan: params.run.generatedPlan,
    context: params.run.context,
  });
}

export async function readExecutionFeedback(params: {
  host: EngineHost;
  run: PreparedRun;
}): Promise<ExecutionFeedbackReadResult> {
  const result = await params.host.readExecutionResult(params.run.runId);

  if (result.status === "ready") {
    await params.host.finalizeRunLog(params.run.logPath, result.result);
  }

  return result;
}

export async function loadRunHistory(host: EngineHost): Promise<LoggedRun[]> {
  return host.listRunLogs();
}
