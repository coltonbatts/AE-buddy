import fs from "node:fs/promises";
import path from "node:path";

import type {
  AEContext,
  ExecutionFeedbackReadResult,
  ExecutionResult,
  GeneratedPlan,
  LoggedRun,
  MotionBuddyRuntimeConfig,
  RunLogEntry,
} from "../shared/types.js";
import { parseAeContext } from "../shared/ae-context.js";
import { createExecutionReceipt, createRunLogEntry, parseExecutionResult, parseRunLogEntry } from "../shared/run-files.js";
import { generatePlan } from "../core/generator.js";
import { resolveMotionRequest } from "../domain/resolve/resolve-motion-request.js";
import type { EngineHost } from "./contracts.js";
import { getConfig } from "./config.js";

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

async function removeIfExists(filePath: string) {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Best effort cleanup only.
  }
}

async function readJsonFile(filePath: string): Promise<
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "ok"; value: unknown }
> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      status: "ok",
      value: JSON.parse(raw) as unknown,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "missing" };
    }

    return {
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createNodeEngineHost(
  config: MotionBuddyRuntimeConfig = getConfig(),
  openAiApiKey = process.env.OPENAI_API_KEY ?? "",
): EngineHost {

  return {
    config,
    async ensureWorkspace() {
      await fs.mkdir(config.contextDir, { recursive: true });
      await fs.mkdir(config.outDir, { recursive: true });
      await fs.mkdir(config.logsDir, { recursive: true });
      await fs.mkdir(config.stateDir, { recursive: true });
    },
    async loadContext() {
      try {
        const raw = await fs.readFile(config.contextPath, "utf8");
        return parseAeContext(raw);
      } catch {
        return parseAeContext(null);
      }
    },
    async generatePlan(params) {
      return resolveMotionRequest({
        prompt: params.prompt,
        context: params.context,
        store: params.store,
        requestModelPlan: openAiApiKey
          ? () =>
              generatePlan({
                prompt: params.prompt,
                context: params.context,
                model: params.model,
                apiKey: openAiApiKey,
              }).then((plan) => ({
                explanation: plan.explanation,
                actionPlan: plan.actionPlan,
                source: plan.source,
              }))
          : undefined,
      });
    },
    async createRunLog(params) {
      const logPath = path.join(config.logsDir, `${params.runId}.json`);
      const entry = createRunLogEntry({
        runId: params.runId,
        prompt: params.prompt,
        generatedPlan: params.generatedPlan,
        context: params.context,
      });

      await atomicWriteText(logPath, JSON.stringify(entry, null, 2));

      return logPath;
    },
    async finalizeRunLog(logPath, executionResult) {
      const rawLog = await readJsonFile(logPath);
      if (rawLog.status !== "ok") {
        return;
      }

      const parsedLog = parseRunLogEntry(rawLog.value);
      if (!parsedLog.value) {
        return;
      }

      parsedLog.value.executionResult = executionResult;
      await atomicWriteText(logPath, JSON.stringify(parsedLog.value, null, 2)).catch(() => undefined);
    },
    async writeExecutionBundle(params: {
      runId: string;
      generatedPlan: GeneratedPlan;
      context: AEContext;
    }) {
      const receipt = createExecutionReceipt({
        runId: params.runId,
        generatedPlan: params.generatedPlan,
        context: params.context,
      });

      await removeIfExists(config.executionResultPath);
      await atomicWriteText(config.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2));
      await atomicWriteText(config.generatedScriptPath, params.generatedPlan.renderedScript);
      await atomicWriteText(config.receiptPath, JSON.stringify(receipt, null, 2));
    },
    async readExecutionResult(runId): Promise<ExecutionFeedbackReadResult> {
      const rawResult = await readJsonFile(config.executionResultPath);
      if (rawResult.status !== "ok") {
        return rawResult.status === "missing" ? rawResult : { status: "invalid", message: rawResult.message };
      }

      const parsedResult = parseExecutionResult(rawResult.value);
      if (!parsedResult.value) {
        return {
          status: "invalid",
          message: parsedResult.errors.join(" | "),
        };
      }

      if (parsedResult.value.runId !== runId) {
        return {
          status: "stale",
          runId: parsedResult.value.runId,
        };
      }

      return {
        status: "ready",
        result: parsedResult.value,
      };
    },
    async listRunLogs() {
      try {
        const entries = await fs.readdir(config.logsDir, { withFileTypes: true });
        const files = entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) => entry.name)
          .sort()
          .reverse();

        const logs = await Promise.all(
          files.map(async (name) => {
            const logPath = path.join(config.logsDir, name);
            const rawLog = await readJsonFile(logPath);
            if (rawLog.status !== "ok") {
              return null;
            }

            const parsedLog = parseRunLogEntry(rawLog.value);
            if (!parsedLog.value) {
              return null;
            }

            return {
              ...parsedLog.value,
              logPath,
            } satisfies LoggedRun;
          }),
        );

        return logs.filter((log): log is LoggedRun => log !== null);
      } catch {
        return [];
      }
    },
  };
}
