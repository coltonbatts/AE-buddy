import type {
  AEContext,
  AEContextSnapshotReadResult,
  CommandStore,
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
  readContextSnapshot(): Promise<AEContextSnapshotReadResult>;
  loadContext(): Promise<AEContext>;
  generatePlan(params: {
    prompt: string;
    context: AEContext;
    model: string;
    store?: CommandStore | null;
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
