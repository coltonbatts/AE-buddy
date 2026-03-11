import type {
  AEContext,
  ExecutionFeedbackReadResult,
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
  generatePlan(params: {
    prompt: string;
    context: AEContext;
    model: string;
  }): Promise<GeneratedPlan>;
  createRunLog(params: {
    runId: string;
    prompt: string;
    generatedPlan: GeneratedPlan;
    context: RunLogEntry["exportedContext"];
  }): Promise<string>;
  finalizeRunLog(logPath: string, executionResult: ExecutionResult | null): Promise<void>;
  writeExecutionBundle(params: {
    runId: string;
    generatedPlan: GeneratedPlan;
    context: AEContext;
  }): Promise<void>;
  readExecutionResult(runId: string): Promise<ExecutionFeedbackReadResult>;
  listRunLogs(): Promise<LoggedRun[]>;
}

export interface PreparedRun {
  runId: string;
  prompt: string;
  context: AEContext;
  generatedPlan: GeneratedPlan;
  logPath: string;
}
