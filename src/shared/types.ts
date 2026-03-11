export type LayerType =
  | "text"
  | "shape"
  | "camera"
  | "light"
  | "null"
  | "footage"
  | "solid"
  | "precomp"
  | "unknown";

export type RiskLevel = "low" | "medium" | "high";

export type ActionType =
  | "ensure_active_comp"
  | "offset_selected_layers"
  | "convert_selected_layers_to_3d"
  | "apply_expression_to_selected_property"
  | "animate_overshoot_scale_on_selected_layers"
  | "ensure_camera"
  | "animate_camera_push"
  | "create_shape_grid"
  | "apply_palette_to_selected_layers";

export type SourceType = "openai" | "rules";

export type RgbColor = [number, number, number];
export type Point3D = [number, number, number];

export interface TransformSnapshot {
  anchorPoint?: number[];
  position?: number[];
  scale?: number[];
  opacity?: number;
  rotation?: number;
  orientation?: number[];
  xRotation?: number;
  yRotation?: number;
  zRotation?: number;
}

export interface LayerContext {
  index: number;
  name: string;
  type: LayerType;
  threeD: boolean;
  inPoint: number;
  outPoint: number;
  startTime: number;
  parentName: string | null;
  enabled: boolean;
  locked: boolean;
  shy: boolean;
  label: number;
  selectedProperties: string[];
  transform: TransformSnapshot;
  textValue?: string;
}

export interface CompContext {
  name: string;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  workAreaStart: number;
  workAreaDuration: number;
  displayStartTime: number;
  numLayers: number;
  hasCamera: boolean;
  activeCameraName: string | null;
  backgroundColor: RgbColor;
}

export interface AEContext {
  exportedAt: string;
  projectName: string;
  activeComp: CompContext | null;
  selectedLayers: LayerContext[];
  notes: string[];
}

export interface EnsureActiveCompAction {
  type: "ensure_active_comp";
}

export interface OffsetSelectedLayersAction {
  type: "offset_selected_layers";
  frames: number;
}

export interface ConvertSelectedLayersTo3DAction {
  type: "convert_selected_layers_to_3d";
}

export interface ApplyExpressionToSelectedPropertyAction {
  type: "apply_expression_to_selected_property";
  expression: string;
  propertyName?: string;
}

export interface AnimateOvershootScaleOnSelectedLayersAction {
  type: "animate_overshoot_scale_on_selected_layers";
  startTimeSeconds?: number;
  durationSeconds?: number;
  introScale?: number;
  overshootScale?: number;
  settleScale?: number;
}

export interface EnsureCameraAction {
  type: "ensure_camera";
  name?: string;
  position?: Point3D;
  pointOfInterest?: Point3D;
  autoOrient?: "none" | "towards_point_of_interest";
}

export interface AnimateCameraPushAction {
  type: "animate_camera_push";
  startTimeSeconds?: number;
  durationSeconds?: number;
  startZ?: number;
  endZ?: number;
  easeInfluence?: number;
}

export interface CreateShapeGridAction {
  type: "create_shape_grid";
  rows?: number;
  columns?: number;
  boxSize?: number;
  spacingX?: number;
  spacingY?: number;
  palette?: RgbColor[];
}

export interface ApplyPaletteToSelectedLayersAction {
  type: "apply_palette_to_selected_layers";
  palette: RgbColor[];
  mode?: "cycle";
}

export type ActionPlanAction =
  | EnsureActiveCompAction
  | OffsetSelectedLayersAction
  | ConvertSelectedLayersTo3DAction
  | ApplyExpressionToSelectedPropertyAction
  | AnimateOvershootScaleOnSelectedLayersAction
  | EnsureCameraAction
  | AnimateCameraPushAction
  | CreateShapeGridAction
  | ApplyPaletteToSelectedLayersAction;

export interface ActionPlan {
  version: "1.0";
  intent: string;
  summary: string;
  riskLevel: RiskLevel;
  assumptions: string[];
  actions: ActionPlanAction[];
  warnings: string[];
}

export interface PlannedResponse {
  explanation: string;
  actionPlan: ActionPlan;
  source: SourceType;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  actionType?: ActionType;
}

export interface PlanValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  affectedTargets: string[];
}

export interface GeneratedPlan {
  prompt: string;
  explanation: string;
  actionPlan: ActionPlan;
  validation: PlanValidationResult;
  renderedScript: string;
  source: SourceType;
}

export interface ExecutionReceipt {
  runId: string;
  prompt: string;
  explanation: string;
  source: SourceType;
  createdAt: string;
  context: AEContext;
  actionPlan: ActionPlan;
  validation: PlanValidationResult;
}

export interface ScriptExecutionResult {
  status: "ok" | "error";
  summary: string;
  message: string;
  warnings: string[];
  actionsExecuted: string[];
  affectedTargets: string[];
}

export interface ExecutionResult {
  runId: string;
  status: "ok" | "error";
  message: string;
  executedAt: string;
  result?: ScriptExecutionResult | null;
}

export interface RunLogEntry {
  runId: string;
  timestamp: string;
  prompt: string;
  exportedContext: AEContext;
  explanation: string;
  source: SourceType;
  actionPlan: ActionPlan;
  validation: PlanValidationResult;
  renderedScript: string;
  executionResult: ExecutionResult | null;
}

export interface MotionBuddyRuntimeConfig {
  rootDir: string;
  exchangeDir: string;
  contextDir: string;
  outDir: string;
  logsDir: string;
  contextPath: string;
  generatedPlanPath: string;
  generatedScriptPath: string;
  receiptPath: string;
  executionResultPath: string;
  exportContextScriptPath: string;
  importScriptPath: string;
  cepCommandUrl: string;
  model: string;
  openAiEnabled: boolean;
}

export interface LoggedRun extends RunLogEntry {
  logPath: string;
}

export type ExecutionFeedbackReadResult =
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "stale"; runId: string }
  | { status: "ready"; result: ExecutionResult };
