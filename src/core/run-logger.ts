import fs from "node:fs/promises";
import path from "node:path";

import type { ExecutionResult, GeneratedPlan, RunLogEntry } from "../types.js";
import { createRunLogEntry, parseRunLogEntry } from "../shared/run-files.js";

async function atomicWriteText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, contents, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function createRunLog(params: {
  logsDir: string;
  runId: string;
  prompt: string;
  generatedPlan: GeneratedPlan;
  context: RunLogEntry["exportedContext"];
}) {
  const logPath = path.join(params.logsDir, `${params.runId}.json`);
  const entry = createRunLogEntry({
    runId: params.runId,
    prompt: params.prompt,
    generatedPlan: params.generatedPlan,
    context: params.context,
  });

  await fs.mkdir(params.logsDir, { recursive: true });
  await atomicWriteText(logPath, JSON.stringify(entry, null, 2));

  return logPath;
}

export async function finalizeRunLog(logPath: string, executionResult: ExecutionResult | null) {
  try {
    const raw = await fs.readFile(logPath, "utf8");
    const parsed = parseRunLogEntry(JSON.parse(raw) as unknown);
    if (!parsed.value) {
      return;
    }
    const existing = parsed.value;
    existing.executionResult = executionResult;
    await atomicWriteText(logPath, JSON.stringify(existing, null, 2));
  } catch {
    // Logging should never stop the execution loop.
  }
}
