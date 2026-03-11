import fs from "node:fs/promises";
import path from "node:path";

import type { AEContext, ExecutionReceipt, ExecutionResult, GeneratedPlan } from "../types.js";
import { createExecutionReceipt, parseExecutionResult } from "../shared/run-files.js";

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

export async function ensureExchangeDirs(paths: {
  contextDir: string;
  outDir: string;
  logsDir: string;
}) {
  await fs.mkdir(paths.contextDir, { recursive: true });
  await fs.mkdir(paths.outDir, { recursive: true });
  await fs.mkdir(paths.logsDir, { recursive: true });
}

export async function writeExecutionBundle(params: {
  runId: string;
  generatedPlanPath: string;
  generatedScriptPath: string;
  receiptPath: string;
  executionResultPath?: string;
  generatedPlan: GeneratedPlan;
  context: AEContext;
}) {
  const receipt: ExecutionReceipt = createExecutionReceipt({
    runId: params.runId,
    generatedPlan: params.generatedPlan,
    context: params.context,
  });

  if (params.executionResultPath) {
    await fs.rm(params.executionResultPath, { force: true }).catch(() => undefined);
  }

  await atomicWriteText(params.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2));
  await atomicWriteText(params.generatedScriptPath, params.generatedPlan.renderedScript);
  await atomicWriteText(params.receiptPath, JSON.stringify(receipt, null, 2));
}

export async function readExecutionResult(executionResultPath: string, runId: string): Promise<ExecutionResult | null> {
  try {
    const raw = await fs.readFile(executionResultPath, "utf8");
    const parsed = parseExecutionResult(JSON.parse(raw) as unknown);
    if (!parsed.value || parsed.value.runId !== runId) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}
