import fs from "node:fs/promises";
import path from "node:path";

import type {
  AEContext,
  ExecutionReceipt,
  ExecutionResult,
  GeneratedPlan,
  LoggedRun,
  MotionBuddyRuntimeConfig,
  RunLogEntry,
} from "../shared/types.js";
import { parseAeContext } from "../shared/ae-context.js";
import type { EngineHost } from "./contracts.js";
import { getConfig } from "./config.js";

function createLogId(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

export function createNodeEngineHost(config: MotionBuddyRuntimeConfig = getConfig()): EngineHost {
  return {
    config,
    async ensureWorkspace() {
      await fs.mkdir(config.contextDir, { recursive: true });
      await fs.mkdir(config.outDir, { recursive: true });
      await fs.mkdir(config.logsDir, { recursive: true });
    },
    async loadContext() {
      try {
        const raw = await fs.readFile(config.contextPath, "utf8");
        return parseAeContext(raw);
      } catch {
        return parseAeContext(null);
      }
    },
    async createRunLog(params) {
      const timestamp = new Date().toISOString();
      const id = createLogId(timestamp);
      const logPath = path.join(config.logsDir, `${id}.json`);

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

      await fs.mkdir(config.logsDir, { recursive: true });
      await fs.writeFile(logPath, JSON.stringify(entry, null, 2), "utf8");

      return logPath;
    },
    async finalizeRunLog(logPath, executionResult) {
      try {
        const raw = await fs.readFile(logPath, "utf8");
        const existing = JSON.parse(raw) as RunLogEntry;
        existing.executionResult = executionResult;
        await fs.writeFile(logPath, JSON.stringify(existing, null, 2), "utf8");
      } catch {
        // Logging should not block the execution path.
      }
    },
    async writeExecutionBundle(params: {
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

      await fs.writeFile(config.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2), "utf8");
      await fs.writeFile(config.generatedScriptPath, params.generatedPlan.renderedScript, "utf8");
      await fs.writeFile(config.receiptPath, JSON.stringify(receipt, null, 2), "utf8");
    },
    async readExecutionResult() {
      try {
        const raw = await fs.readFile(config.executionResultPath, "utf8");
        return JSON.parse(raw) as ExecutionResult;
      } catch {
        return null;
      }
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
            const raw = await fs.readFile(logPath, "utf8");
            return {
              ...(JSON.parse(raw) as RunLogEntry),
              logPath,
            } satisfies LoggedRun;
          }),
        );

        return logs;
      } catch {
        return [];
      }
    },
  };
}
