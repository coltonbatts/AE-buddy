import path from "node:path";

import type { MotionBuddyRuntimeConfig } from "../shared/types.js";

export function getConfig(rootDir = process.cwd()): MotionBuddyRuntimeConfig {
  const exchangeDir = path.join(rootDir, ".motion-buddy");
  const contextDir = path.join(exchangeDir, "context");
  const outDir = path.join(exchangeDir, "out");
  const logsDir = path.join(exchangeDir, "logs");
  const stateDir = path.join(exchangeDir, "state");
  const cepCommandUrl = process.env.MOTION_BUDDY_CEP_URL ?? "http://127.0.0.1:9123/motion-buddy/execute";

  return {
    rootDir,
    exchangeDir,
    contextDir,
    outDir,
    logsDir,
    stateDir,
    contextPath: path.join(contextDir, "ae-context.json"),
    generatedPlanPath: path.join(outDir, "generated-plan.json"),
    generatedScriptPath: path.join(outDir, "generated-script.jsx"),
    receiptPath: path.join(outDir, "receipt.json"),
    executionResultPath: path.join(outDir, "execution-result.json"),
    commandStorePath: path.join(stateDir, "command-store.json"),
    exportContextScriptPath: path.join(rootDir, "after-effects", "export-context.jsx"),
    importScriptPath: path.join(rootDir, "after-effects", "import-generated-script.jsx"),
    cepCommandUrl,
    model: process.env.MOTION_BUDDY_MODEL ?? "gpt-4.1-mini",
    openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
  };
}
