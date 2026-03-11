import type { AEContext, LayerType } from "../../shared/types.js";

export interface AEContextModel {
  raw: AEContext;
  hasActiveComp: boolean;
  activeCompName: string | null;
  frameRate: number;
  currentTime: number;
  selectedLayerCount: number;
  selectedLayerTypes: LayerType[];
  hasSelectedProperties: boolean;
  selectedKeyframeCount: number;
  hasSelectedKeyframes: boolean;
  hasTextSelection: boolean;
  hasShapeSelection: boolean;
  hasCamera: boolean;
}

export function createAeContextModel(context: AEContext): AEContextModel {
  const selectedLayerTypes = Array.from(new Set(context.selectedLayers.map((layer) => layer.type)));

  return {
    raw: context,
    hasActiveComp: context.activeComp !== null,
    activeCompName: context.activeComp?.name ?? null,
    frameRate: context.activeComp?.frameRate ?? 24,
    currentTime: context.activeComp?.currentTime ?? 0,
    selectedLayerCount: context.selectedLayers.length,
    selectedLayerTypes,
    hasSelectedProperties: context.selectedLayers.some((layer) => layer.selectedProperties.length > 0),
    selectedKeyframeCount: context.selectedLayers.reduce((count, layer) => count + layer.selectedKeyframeCount, 0),
    hasSelectedKeyframes: context.selectedLayers.some((layer) => layer.selectedKeyframeCount > 0),
    hasTextSelection: context.selectedLayers.some((layer) => layer.type === "text"),
    hasShapeSelection: context.selectedLayers.some((layer) => layer.type === "shape"),
    hasCamera: context.activeComp?.hasCamera ?? false,
  };
}
