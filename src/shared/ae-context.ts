import type { AEContext, CompContext, LayerContext, LayerType, TransformSnapshot } from "./types.js";

function normalizeTransform(raw: unknown): TransformSnapshot {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const value = raw as Record<string, unknown>;
  return {
    anchorPoint: Array.isArray(value.anchorPoint) ? (value.anchorPoint as number[]) : undefined,
    position: Array.isArray(value.position) ? (value.position as number[]) : undefined,
    scale: Array.isArray(value.scale) ? (value.scale as number[]) : undefined,
    opacity: typeof value.opacity === "number" ? value.opacity : undefined,
    rotation: typeof value.rotation === "number" ? value.rotation : undefined,
    orientation: Array.isArray(value.orientation) ? (value.orientation as number[]) : undefined,
    xRotation: typeof value.xRotation === "number" ? value.xRotation : undefined,
    yRotation: typeof value.yRotation === "number" ? value.yRotation : undefined,
    zRotation: typeof value.zRotation === "number" ? value.zRotation : undefined,
  };
}

function normalizeLayer(raw: unknown, index: number): LayerContext {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    index: typeof value.index === "number" ? value.index : index + 1,
    name: typeof value.name === "string" ? value.name : `Layer ${index + 1}`,
    type: (typeof value.type === "string" ? value.type : "unknown") as LayerType,
    threeD: value.threeD === true,
    inPoint: typeof value.inPoint === "number" ? value.inPoint : 0,
    outPoint: typeof value.outPoint === "number" ? value.outPoint : 0,
    startTime: typeof value.startTime === "number" ? value.startTime : 0,
    parentName: typeof value.parentName === "string" ? value.parentName : null,
    enabled: value.enabled !== false,
    locked: value.locked === true,
    shy: value.shy === true,
    label: typeof value.label === "number" ? value.label : 0,
    selectedProperties: Array.isArray(value.selectedProperties)
      ? value.selectedProperties.filter((item): item is string => typeof item === "string")
      : [],
    transform: normalizeTransform(value.transform),
    textValue: typeof value.textValue === "string" ? value.textValue : undefined,
  };
}

function normalizeComp(raw: unknown): CompContext | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const backgroundColor = Array.isArray(value.backgroundColor)
    ? (value.backgroundColor as [number, number, number])
    : ([0, 0, 0] as [number, number, number]);

  return {
    name: typeof value.name === "string" ? value.name : "Untitled Comp",
    width: typeof value.width === "number" ? value.width : 1920,
    height: typeof value.height === "number" ? value.height : 1080,
    duration: typeof value.duration === "number" ? value.duration : 0,
    frameRate: typeof value.frameRate === "number" ? value.frameRate : 24,
    workAreaStart: typeof value.workAreaStart === "number" ? value.workAreaStart : 0,
    workAreaDuration: typeof value.workAreaDuration === "number" ? value.workAreaDuration : 0,
    displayStartTime: typeof value.displayStartTime === "number" ? value.displayStartTime : 0,
    numLayers: typeof value.numLayers === "number" ? value.numLayers : 0,
    hasCamera: value.hasCamera === true,
    activeCameraName: typeof value.activeCameraName === "string" ? value.activeCameraName : null,
    backgroundColor,
  };
}

export function emptyContext(): AEContext {
  return {
    exportedAt: new Date(0).toISOString(),
    projectName: "Untitled Project",
    activeComp: null,
    selectedLayers: [],
    notes: [
      "No After Effects context export was found.",
      "Run after-effects/export-context.jsx from After Effects before generating scripts for accurate results.",
    ],
  };
}

export function normalizeContext(raw: unknown): AEContext {
  if (!raw || typeof raw !== "object") {
    return emptyContext();
  }

  const value = raw as Record<string, unknown>;

  return {
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date(0).toISOString(),
    projectName: typeof value.projectName === "string" ? value.projectName : "Untitled Project",
    activeComp: normalizeComp(value.activeComp),
    selectedLayers: Array.isArray(value.selectedLayers) ? value.selectedLayers.map(normalizeLayer) : [],
    notes: Array.isArray(value.notes) ? value.notes.filter((note): note is string => typeof note === "string") : [],
  };
}

export function parseAeContext(raw: string | unknown): AEContext {
  if (typeof raw === "string") {
    try {
      return normalizeContext(JSON.parse(raw));
    } catch {
      return emptyContext();
    }
  }

  return normalizeContext(raw);
}

export function summarizeContext(context: AEContext): string {
  const activeComp = context.activeComp
    ? `${context.activeComp.name} (${context.activeComp.width}x${context.activeComp.height}, ${context.activeComp.duration}s @ ${context.activeComp.frameRate}fps)`
    : "No active comp";

  const selectedLayers =
    context.selectedLayers.length > 0
      ? context.selectedLayers
          .map((layer) => `${layer.index}:${layer.name}[${layer.type}${layer.threeD ? ",3D" : ",2D"}]`)
          .join(", ")
      : "No selected layers";

  const cameraInfo = context.activeComp
    ? `Camera: ${context.activeComp.hasCamera ? context.activeComp.activeCameraName ?? "present" : "none"}`
    : "";

  return [
    `Project: ${context.projectName}`,
    `Exported: ${context.exportedAt}`,
    `Active comp: ${activeComp}`,
    cameraInfo,
    `Selected layers: ${selectedLayers}`,
    context.notes.length > 0 ? `Notes: ${context.notes.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
