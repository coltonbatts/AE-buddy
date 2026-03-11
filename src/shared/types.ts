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
  | "apply_palette_to_selected_layers"
  | "center_anchor_point_on_selected_layers"
  | "parent_selected_layers_to_null"
  | "trim_selected_layers_to_playhead"
  | "precompose_selected_layers"
  | "easy_ease_selected_keyframes"
  | "toggle_motion_blur_on_selected_layers"
  | "create_text_layer";

export type SourceType = "registry" | "openai" | "rules";
export type ResolutionKind = "built-in-command" | "recipe" | "saved-recipe" | "generated";

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
  selectedKeyframeCount: number;
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
  currentTime: number;
  numLayers: number;
  hasCamera: boolean;
  activeCameraName: string | null;
  backgroundColor: RgbColor;
}

export interface AEContext {
  exportedAt: string;
  projectName: string;
  projectPath: string | null;
  activeComp: CompContext | null;
  selectedLayers: LayerContext[];
  notes: string[];
}

export type AEContextSnapshotReadResult =
  | { status: "ok"; context: AEContext }
  | { status: "missing" }
  | { status: "invalid"; message: string };

export type AESyncStatus = "connected" | "stale" | "disconnected";
export type AESyncMode = "cep-polling" | "file-fallback";

export interface AESessionRecord {
  id: string;
  projectName: string;
  projectPath: string | null;
  activeCompName: string | null;
  selectedLayerCount: number;
  selectedKeyframeCount: number;
  isActive: boolean;
  isUnsaved: boolean;
  lastSeenAt: string;
  lastContext: AEContext;
}

export interface AELiveState {
  sessions: AESessionRecord[];
  activeSessionId: string | null;
  status: AESyncStatus;
  syncMode: AESyncMode;
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastContextExportAt: string | null;
  lastError: string | null;
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

export interface CenterAnchorPointOnSelectedLayersAction {
  type: "center_anchor_point_on_selected_layers";
}

export interface ParentSelectedLayersToNullAction {
  type: "parent_selected_layers_to_null";
  nullName?: string;
}

export interface TrimSelectedLayersToPlayheadAction {
  type: "trim_selected_layers_to_playhead";
}

export interface PrecomposeSelectedLayersAction {
  type: "precompose_selected_layers";
  name?: string;
  moveAllAttributes?: boolean;
}

export interface EasyEaseSelectedKeyframesAction {
  type: "easy_ease_selected_keyframes";
  easeInfluence?: number;
}

export interface ToggleMotionBlurOnSelectedLayersAction {
  type: "toggle_motion_blur_on_selected_layers";
}

export interface CreateTextLayerAction {
  type: "create_text_layer";
  text?: string;
  name?: string;
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
  | ApplyPaletteToSelectedLayersAction
  | CenterAnchorPointOnSelectedLayersAction
  | ParentSelectedLayersToNullAction
  | TrimSelectedLayersToPlayheadAction
  | PrecomposeSelectedLayersAction
  | EasyEaseSelectedKeyframesAction
  | ToggleMotionBlurOnSelectedLayersAction
  | CreateTextLayerAction;

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

export interface PlanResolution {
  kind: ResolutionKind;
  title: string;
  matchedQuery: string;
  confidence: number;
  id?: string;
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
  resolution: PlanResolution;
}

export interface ExecutionReceipt {
  runId: string;
  prompt: string;
  explanation: string;
  source: SourceType;
  resolution: PlanResolution;
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
  resolution: PlanResolution;
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
  stateDir: string;
  contextPath: string;
  generatedPlanPath: string;
  generatedScriptPath: string;
  receiptPath: string;
  executionResultPath: string;
  commandStorePath: string;
  exportContextScriptPath: string;
  importScriptPath: string;
  cepCommandUrl: string;
  cepHealthUrl: string;
  cepContextExportUrl: string;
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

export interface CommandHistoryEntry {
  id: string;
  entityId: string;
  commandId: string;
  title: string;
  kind: ResolutionKind;
  resolutionType: ResolutionKind;
  prompt: string;
  source: SourceType;
  recordedAt: string;
}

export interface CommandUsageStat {
  entityId: string;
  commandId: string;
  title: string;
  kind: ResolutionKind;
  count: number;
  lastRecordedAt: string;
}

export interface SavedRecipeRecord {
  id: string;
  title: string;
  description: string;
  prompt: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  source: SourceType;
  actionPlan: ActionPlan;
}

export interface CommandStore {
  version: "1.0";
  updatedAt: string;
  favoriteIds: string[];
  recentCommands: CommandHistoryEntry[];
  usageStats: CommandUsageStat[];
  savedRecipes: SavedRecipeRecord[];
}
