import { exists, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

import type {
  AEContext,
  ExecutionReceipt,
  ExecutionResult,
  GeneratedPlan,
  LoggedRun,
  MotionBuddyRuntimeConfig,
  RunLogEntry,
} from "@/shared/types.js";
import { parseAeContext } from "@/shared/ae-context.js";
import type { EngineHost } from "@/engine/contracts.js";
import { getRuntimeConfig } from "./desktop-api.js";

function createLogId(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

export async function createDesktopEngineHost(): Promise<EngineHost> {
  const config = await getRuntimeConfig();

  return {
    config,
    async ensureWorkspace() {
      await mkdir(config.contextDir, { recursive: true });
      await mkdir(config.outDir, { recursive: true });
      await mkdir(config.logsDir, { recursive: true });
    },
    async loadContext() {
      if (!(await exists(config.contextPath))) {
        return parseAeContext(null);
      }

      return parseAeContext(await readTextFile(config.contextPath));
    },
    async createRunLog(params) {
      const timestamp = new Date().toISOString();
      const id = createLogId(timestamp);
      const logPath = await join(config.logsDir, `${id}.json`);

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

      await writeTextFile(logPath, JSON.stringify(entry, null, 2));
      return logPath;
    },
    async finalizeRunLog(logPath, executionResult) {
      if (!(await exists(logPath))) {
        return;
      }

      const raw = await readTextFile(logPath);
      const existing = JSON.parse(raw) as RunLogEntry;
      existing.executionResult = executionResult;
      await writeTextFile(logPath, JSON.stringify(existing, null, 2));
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

      await writeTextFile(config.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2));
      await writeTextFile(config.generatedScriptPath, params.generatedPlan.renderedScript);
      await writeTextFile(config.receiptPath, JSON.stringify(receipt, null, 2));
    },
    async readExecutionResult() {
      if (!(await exists(config.executionResultPath))) {
        return null;
      }

      return JSON.parse(await readTextFile(config.executionResultPath)) as ExecutionResult;
    },
    async listRunLogs() {
      if (!(await exists(config.logsDir))) {
        return [];
      }

      const entries = await readDir(config.logsDir);
      const files = entries
        .filter((entry) => entry.isFile && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      const logs = await Promise.all(
        files.map(async (name) => {
          const logPath = await join(config.logsDir, name);
          const raw = await readTextFile(logPath);
          return {
            ...(JSON.parse(raw) as RunLogEntry),
            logPath,
          } satisfies LoggedRun;
        }),
      );

      return logs;
    },
  } satisfies EngineHost;
}
