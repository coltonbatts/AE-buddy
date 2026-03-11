import type {
  AEContext,
  ExecutionResult,
  GeneratedPlan,
  LoggedRun,
  MotionBuddyRuntimeConfig,
  RunLogEntry,
} from "../shared/types.js";

export interface EngineHost {
  readonly config: MotionBuddyRuntimeConfig;
  ensureWorkspace(): Promise<void>;
  loadContext(): Promise<AEContext>;
  createRunLog(params: {
    prompt: string;
    generatedPlan: GeneratedPlan;
    context: RunLogEntry["exportedContext"];
  }): Promise<string>;
  finalizeRunLog(logPath: string, executionResult: ExecutionResult | null): Promise<void>;
  writeExecutionBundle(params: {
    generatedPlan: GeneratedPlan;
    context: AEContext;
  }): Promise<void>;
  readExecutionResult(): Promise<ExecutionResult | null>;
  listRunLogs(): Promise<LoggedRun[]>;
}

export interface PreparedRun {
  prompt: string;
  context: AEContext;
  generatedPlan: GeneratedPlan;
  logPath: string;
}
