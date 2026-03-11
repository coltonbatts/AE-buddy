import fs from "node:fs/promises";
import path from "node:path";

import type { ExecutionResult, GeneratedPlan, RunLogEntry } from "../types.js";

function createLogId(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

export async function createRunLog(params: {
  logsDir: string;
  prompt: string;
  generatedPlan: GeneratedPlan;
  context: RunLogEntry["exportedContext"];
}) {
  const timestamp = new Date().toISOString();
  const id = createLogId(timestamp);
  const logPath = path.join(params.logsDir, `${id}.json`);

  const entry: RunLogEntry = {
    id,
    timestamp,
    prompt: params.prompt,
    exportedContext: params.context,
    explanation: params.generatedPlan.explanation,
    source: params.generatedPlan.source,
    actionPlan: params.generatedPlan.actionPlan,
    validation: params.generatedPlan.validation,
    renderedScript: params.generatedPlan.renderedScript,
    executionResult: null,
  };

  await fs.mkdir(params.logsDir, { recursive: true });
  await fs.writeFile(logPath, JSON.stringify(entry, null, 2), "utf8");

  return logPath;
}

export async function finalizeRunLog(logPath: string, executionResult: ExecutionResult | null) {
  try {
    const raw = await fs.readFile(logPath, "utf8");
    const existing = JSON.parse(raw) as RunLogEntry;
    existing.executionResult = executionResult;
    await fs.writeFile(logPath, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Logging should never stop the execution loop.
  }
}
