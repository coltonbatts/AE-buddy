import fs from "node:fs/promises";

import type { AEContext, ExecutionReceipt, ExecutionResult, GeneratedPlan } from "../types.js";

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
  generatedPlanPath: string;
  generatedScriptPath: string;
  receiptPath: string;
  generatedPlan: GeneratedPlan;
  context: AEContext;
}) {
  const receipt: ExecutionReceipt = {
    prompt: params.generatedPlan.prompt,
    explanation: params.generatedPlan.explanation,
    source: params.generatedPlan.source,
    createdAt: new Date().toISOString(),
    context: params.context,
    actionPlan: params.generatedPlan.actionPlan,
    validation: params.generatedPlan.validation,
  };

  await fs.writeFile(params.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2), "utf8");
  await fs.writeFile(params.generatedScriptPath, params.generatedPlan.renderedScript, "utf8");
  await fs.writeFile(params.receiptPath, JSON.stringify(receipt, null, 2), "utf8");
}

export async function readExecutionResult(executionResultPath: string): Promise<ExecutionResult | null> {
  try {
    const raw = await fs.readFile(executionResultPath, "utf8");
    return JSON.parse(raw) as ExecutionResult;
  } catch {
    return null;
  }
}
