import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";

import { parseModelResponse } from "../../core/action-plan-validator.js";
import { generatePlanWithPlanner } from "../../core/planner.js";
import { systemPrompt } from "../../core/system-prompt.js";
import type {
  AEContext,
  ExecutionFeedbackReadResult,
  GeneratedPlan,
  LoggedRun,
  MotionBuddyRuntimeConfig,
} from "../../shared/types.js";
import { parseAeContext } from "../../shared/ae-context.js";
import { createExecutionReceipt, createRunLogEntry, parseExecutionResult, parseRunLogEntry } from "../../shared/run-files.js";
import type { EngineHost } from "../../engine/contracts.js";
import { generateOpenAiPlan, getRuntimeConfig } from "./desktop-api.js";

interface DesktopFs {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readDir(path: string): Promise<Array<{ name: string; isFile?: boolean }>>;
  readTextFile(path: string): Promise<string>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
}

interface DesktopHostDeps {
  fs: DesktopFs;
  join: typeof join;
  getRuntimeConfig: typeof getRuntimeConfig;
  requestOpenAiPlan: typeof generateOpenAiPlan;
}

const defaultDeps: DesktopHostDeps = {
  fs: {
    exists,
    mkdir,
    readDir,
    readTextFile,
    remove,
    rename,
    writeTextFile,
  },
  join,
  getRuntimeConfig,
  requestOpenAiPlan: generateOpenAiPlan,
};

async function atomicWriteText(fs: DesktopFs, filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  await fs.writeTextFile(tempPath, contents);
  await fs.rename(tempPath, filePath);
}

async function removeIfExists(fs: DesktopFs, filePath: string) {
  if (!(await fs.exists(filePath))) {
    return;
  }

  await fs.remove(filePath).catch(() => undefined);
}

async function readJsonFile(fs: DesktopFs, filePath: string): Promise<
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "ok"; value: unknown }
> {
  if (!(await fs.exists(filePath))) {
    return { status: "missing" };
  }

  try {
    const raw = await fs.readTextFile(filePath);
    return {
      status: "ok",
      value: JSON.parse(raw) as unknown,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createDesktopEngineHost(overrides: Partial<DesktopHostDeps> = {}): Promise<EngineHost> {
  const deps = {
    ...defaultDeps,
    ...overrides,
    fs: {
      ...defaultDeps.fs,
      ...overrides.fs,
    },
  } satisfies DesktopHostDeps;
  const config = await deps.getRuntimeConfig();

  return {
    config,
    async ensureWorkspace() {
      await deps.fs.mkdir(config.contextDir, { recursive: true });
      await deps.fs.mkdir(config.outDir, { recursive: true });
      await deps.fs.mkdir(config.logsDir, { recursive: true });
    },
    async loadContext() {
      if (!(await deps.fs.exists(config.contextPath))) {
        return parseAeContext(null);
      }

      return parseAeContext(await deps.fs.readTextFile(config.contextPath));
    },
    async generatePlan(params) {
      return generatePlanWithPlanner({
        prompt: params.prompt,
        context: params.context,
        requestModelPlan: config.openAiEnabled
          ? async () => {
              const raw = await deps.requestOpenAiPlan({
                model: params.model,
                systemPrompt,
                prompt: params.prompt,
                context: params.context,
              });
              const parsed = parseModelResponse(raw);
              if (!parsed.value) {
                throw new Error(parsed.errors.join(" | "));
              }
              return parsed.value;
            }
          : undefined,
      });
    },
    async createRunLog(params) {
      const logPath = await deps.join(config.logsDir, `${params.runId}.json`);
      const entry = createRunLogEntry({
        runId: params.runId,
        prompt: params.prompt,
        generatedPlan: params.generatedPlan,
        context: params.context,
      });

      await atomicWriteText(deps.fs, logPath, JSON.stringify(entry, null, 2));
      return logPath;
    },
    async finalizeRunLog(logPath, executionResult) {
      const rawLog = await readJsonFile(deps.fs, logPath);
      if (rawLog.status !== "ok") {
        return;
      }

      const parsedLog = parseRunLogEntry(rawLog.value);
      if (!parsedLog.value) {
        return;
      }

      parsedLog.value.executionResult = executionResult;
      await atomicWriteText(deps.fs, logPath, JSON.stringify(parsedLog.value, null, 2)).catch(() => undefined);
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

      await removeIfExists(deps.fs, config.executionResultPath);
      await atomicWriteText(deps.fs, config.generatedPlanPath, JSON.stringify(params.generatedPlan.actionPlan, null, 2));
      await atomicWriteText(deps.fs, config.generatedScriptPath, params.generatedPlan.renderedScript);
      await atomicWriteText(deps.fs, config.receiptPath, JSON.stringify(receipt, null, 2));
    },
    async readExecutionResult(runId): Promise<ExecutionFeedbackReadResult> {
      const rawResult = await readJsonFile(deps.fs, config.executionResultPath);
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
      if (!(await deps.fs.exists(config.logsDir))) {
        return [];
      }

      const entries = await deps.fs.readDir(config.logsDir);
      const files = entries
        .filter((entry) => entry.isFile && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      const logs = await Promise.all(
        files.map(async (name) => {
          const logPath = await deps.join(config.logsDir, name);
          const rawLog = await readJsonFile(deps.fs, logPath);
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
    },
  } satisfies EngineHost;
}
