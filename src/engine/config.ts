import path from "node:path";

import type { MotionBuddyRuntimeConfig } from "../shared/types.js";

export function getConfig(rootDir = process.cwd()): MotionBuddyRuntimeConfig {
  const exchangeDir = path.join(rootDir, ".motion-buddy");
  const contextDir = path.join(exchangeDir, "context");
  const outDir = path.join(exchangeDir, "out");
  const logsDir = path.join(exchangeDir, "logs");

  return {
    rootDir,
    exchangeDir,
    contextDir,
    outDir,
    logsDir,
    contextPath: path.join(contextDir, "ae-context.json"),
    generatedPlanPath: path.join(outDir, "generated-plan.json"),
    generatedScriptPath: path.join(outDir, "generated-script.jsx"),
    receiptPath: path.join(outDir, "receipt.json"),
    executionResultPath: path.join(outDir, "execution-result.json"),
    exportContextScriptPath: path.join(rootDir, "after-effects", "export-context.jsx"),
    importScriptPath: path.join(rootDir, "after-effects", "import-generated-script.jsx"),
    model: process.env.MOTION_BUDDY_MODEL ?? "gpt-4.1-mini",
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  };
}
