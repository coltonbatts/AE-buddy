import type {
  ActionPlan,
  ActionPlanAction,
  AEContext,
  AnimateCameraPushAction,
  AnimateOvershootScaleOnSelectedLayersAction,
  ApplyExpressionToSelectedPropertyAction,
  ApplyPaletteToSelectedLayersAction,
  CreateShapeGridAction,
  EnsureCameraAction,
  OffsetSelectedLayersAction,
  RgbColor,
} from "../types.js";

function escapeJsString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function asJsString(value: string) {
  return `"${escapeJsString(value)}"`;
}

function round(value: number) {
  return Number(value.toFixed(5));
}

function renderArray(values: readonly number[]) {
  return `[${values.map((value) => round(value)).join(", ")}]`;
}

function normalizePalette(palette?: RgbColor[]) {
  return palette && palette.length > 0
    ? palette
    : ([
        [0.9608, 0.3294, 0.298],
        [0.9961, 0.7725, 0.2314],
        [0.1765, 0.6745, 0.6431],
        [0.149, 0.3529, 0.7216],
      ] as RgbColor[]);
}

function defaultCameraPosition(context: AEContext) {
  const width = context.activeComp?.width ?? 1920;
  const height = context.activeComp?.height ?? 1080;
  return [Math.round(width / 2), Math.round(height / 2), -1200];
}

function defaultPointOfInterest(context: AEContext) {
  const width = context.activeComp?.width ?? 1920;
  const height = context.activeComp?.height ?? 1080;
  return [Math.round(width / 2), Math.round(height / 2), 0];
}

function renderEnsureActiveComp() {
  return [
    "comp = mbRequireComp();",
    'mbRecordTarget("comp:" + comp.name);',
    'mbRecordAction("ensure_active_comp");',
  ].join("\n");
}

function renderOffsetSelectedLayers(action: OffsetSelectedLayersAction, context: AEContext) {
  const frameRate = context.activeComp?.frameRate ?? 24;
  const seconds = round(action.frames / frameRate);

  return [
    "comp = mbRequireComp();",
    "selectedLayers = mbRequireSelectedLayers(comp);",
    "for (var i = 0; i < selectedLayers.length; i++) {",
    `  selectedLayers[i].startTime += ${seconds};`,
    '  mbRecordTarget("layer:" + selectedLayers[i].name);',
    "}",
    `mbResult.message = "Offset " + selectedLayers.length + " selected layers by ${action.frames} frames.";`,
    `mbRecordAction("offset_selected_layers");`,
  ].join("\n");
}

function renderConvertSelectedLayersTo3D() {
  return [
    "comp = mbRequireComp();",
    "selectedLayers = mbRequireSelectedLayers(comp);",
    "for (var i = 0; i < selectedLayers.length; i++) {",
    "  if (selectedLayers[i] instanceof CameraLayer || selectedLayers[i] instanceof LightLayer) {",
    "    continue;",
    "  }",
    "  selectedLayers[i].threeDLayer = true;",
    '  mbRecordTarget("layer:" + selectedLayers[i].name);',
    "}",
    'mbResult.message = "Converted the selected layers to 3D."; ',
    'mbRecordAction("convert_selected_layers_to_3d");',
  ].join("\n");
}

function renderApplyExpression(action: ApplyExpressionToSelectedPropertyAction) {
  const propertyNameLine = action.propertyName ? `var mbRequestedPropertyName = ${asJsString(action.propertyName)};` : "var mbRequestedPropertyName = null;";

  return [
    "comp = mbRequireComp();",
    "selectedLayers = mbRequireSelectedLayers(comp);",
    propertyNameLine,
    "var mbAppliedExpression = false;",
    "for (var i = 0; i < selectedLayers.length; i++) {",
    "  var layerProperties = selectedLayers[i].selectedProperties;",
    "  for (var j = 0; j < layerProperties.length; j++) {",
    "    var selectedProperty = layerProperties[j];",
    "    if (!selectedProperty || !selectedProperty.canSetExpression) {",
    "      continue;",
    "    }",
    "    if (mbRequestedPropertyName && selectedProperty.name !== mbRequestedPropertyName) {",
    "      continue;",
    "    }",
    `    selectedProperty.expression = ${asJsString(action.expression)};`,
    "    mbAppliedExpression = true;",
    '    mbRecordTarget("layer:" + selectedLayers[i].name + ":" + selectedProperty.name);',
    "  }",
    "}",
    "if (!mbAppliedExpression) {",
    '  throw new Error("No compatible selected properties were found for expression application.");',
    "}",
    'mbResult.message = "Applied the requested expression to selected properties."; ',
    'mbRecordAction("apply_expression_to_selected_property");',
  ].join("\n");
}

function renderOvershootScale(action: AnimateOvershootScaleOnSelectedLayersAction) {
  const startTimeOffset = round(action.startTimeSeconds ?? 0);
  const duration = round(action.durationSeconds ?? 0.65);
  const introScale = round(action.introScale ?? 85);
  const overshootScale = round(action.overshootScale ?? 108);
  const settleScale = round(action.settleScale ?? 100);
  const overshootDuration = round(duration * 0.54);

  return [
    "comp = mbRequireComp();",
    "selectedLayers = mbRequireSelectedLayers(comp);",
    "for (var i = 0; i < selectedLayers.length; i++) {",
    `  var layerStart = selectedLayers[i].inPoint + ${startTimeOffset};`,
    '  var scale = selectedLayers[i].property("ADBE Transform Group").property("ADBE Scale");',
    `  scale.setValueAtTime(layerStart, mbUniformScaleValue(scale, ${introScale}));`,
    `  scale.setValueAtTime(layerStart + ${overshootDuration}, mbUniformScaleValue(scale, ${overshootScale}));`,
    `  scale.setValueAtTime(layerStart + ${duration}, mbUniformScaleValue(scale, ${settleScale}));`,
    "  var easeOut = new KeyframeEase(0, 75);",
    "  var easeIn = new KeyframeEase(0, 55);",
    "  if (scale.numKeys >= 3) {",
    "    var outgoing = mbEasePair(scale, easeOut);",
    "    var incoming = mbEasePair(scale, easeIn);",
    "    scale.setTemporalEaseAtKey(scale.numKeys - 2, outgoing, incoming);",
    "    scale.setTemporalEaseAtKey(scale.numKeys - 1, incoming, incoming);",
    "    scale.setTemporalEaseAtKey(scale.numKeys, incoming, incoming);",
    "  }",
    '  mbRecordTarget("layer:" + selectedLayers[i].name);',
    "}",
    'mbResult.message = "Applied overshoot scale animation to the selected layers."; ',
    'mbRecordAction("animate_overshoot_scale_on_selected_layers");',
  ].join("\n");
}

function renderEnsureCamera(action: EnsureCameraAction, context: AEContext) {
  const position = action.position ?? defaultCameraPosition(context);
  const pointOfInterest = action.pointOfInterest ?? defaultPointOfInterest(context);
  const cameraName = action.name ?? "Motion Buddy Camera";
  const autoOrient =
    action.autoOrient === "towards_point_of_interest"
      ? "AutoOrientType.CAMERA_OR_POINT_OF_INTEREST"
      : "AutoOrientType.NO_AUTO_ORIENT";

  return [
    "comp = mbRequireComp();",
    `mbCamera = mbEnsureCamera(comp, ${asJsString(cameraName)}, ${renderArray(position)}, ${renderArray(pointOfInterest)}, ${autoOrient});`,
    'mbRecordTarget("layer:" + mbCamera.name);',
    `mbResult.message = "Ensured a camera exists in the active composition.";`,
    'mbRecordAction("ensure_camera");',
  ].join("\n");
}

function renderAnimateCameraPush(action: AnimateCameraPushAction, context: AEContext) {
  const duration = round(action.durationSeconds ?? 2);
  const startTime = round(action.startTimeSeconds ?? 0);
  const startZ = round(action.startZ ?? -1200);
  const endZ = round(action.endZ ?? -600);
  const easeInfluence = round(action.easeInfluence ?? 65);
  const fallbackPosition = defaultCameraPosition(context);
  const fallbackPoi = defaultPointOfInterest(context);

  return [
    "comp = mbRequireComp();",
    `mbCamera = mbCamera || mbEnsureCamera(comp, "Motion Buddy Camera", ${renderArray(fallbackPosition)}, ${renderArray(fallbackPoi)}, AutoOrientType.NO_AUTO_ORIENT);`,
    'var mbCameraPosition = mbCamera.property("ADBE Transform Group").property("ADBE Position");',
    "var mbCurrentValue = mbCameraPosition.value;",
    `var mbPushStart = [mbCurrentValue[0], mbCurrentValue[1], ${startZ}];`,
    `var mbPushEnd = [mbCurrentValue[0], mbCurrentValue[1], ${endZ}];`,
    `mbCameraPosition.setValueAtTime(${startTime}, mbPushStart);`,
    `mbCameraPosition.setValueAtTime(Math.min(comp.duration, ${round(startTime + duration)}), mbPushEnd);`,
    `var mbCameraEase = new KeyframeEase(0, ${easeInfluence});`,
    "if (mbCameraPosition.numKeys >= 2) {",
    "  mbCameraPosition.setTemporalEaseAtKey(mbCameraPosition.numKeys - 1, [mbCameraEase, mbCameraEase, mbCameraEase], [mbCameraEase, mbCameraEase, mbCameraEase]);",
    "  mbCameraPosition.setTemporalEaseAtKey(mbCameraPosition.numKeys, [mbCameraEase, mbCameraEase, mbCameraEase], [mbCameraEase, mbCameraEase, mbCameraEase]);",
    "}",
    'mbRecordTarget("layer:" + mbCamera.name);',
    'mbResult.message = "Animated a camera push in the active composition."; ',
    'mbRecordAction("animate_camera_push");',
  ].join("\n");
}

function renderCreateShapeGrid(action: CreateShapeGridAction) {
  const rows = Math.max(1, Math.round(action.rows ?? 4));
  const columns = Math.max(1, Math.round(action.columns ?? 4));
  const boxSize = round(action.boxSize ?? 120);
  const spacingX = round(action.spacingX ?? 220);
  const spacingY = round(action.spacingY ?? 220);
  const palette = normalizePalette(action.palette);

  return [
    "comp = mbRequireComp();",
    `var mbGridRows = ${rows};`,
    `var mbGridColumns = ${columns};`,
    `var mbGridBoxSize = ${boxSize};`,
    `var mbGridSpacingX = ${spacingX};`,
    `var mbGridSpacingY = ${spacingY};`,
    `var mbGridPalette = ${JSON.stringify(palette)};`,
    "var mbGridStartX = (comp.width - ((mbGridColumns - 1) * mbGridSpacingX)) / 2;",
    "var mbGridStartY = (comp.height - ((mbGridRows - 1) * mbGridSpacingY)) / 2;",
    "for (var row = 0; row < mbGridRows; row++) {",
    "  for (var col = 0; col < mbGridColumns; col++) {",
    "    var layerIndex = row * mbGridColumns + col;",
    "    var shapeLayer = comp.layers.addShape();",
    '    shapeLayer.name = "Grid Cell " + (layerIndex + 1);',
    '    var contents = shapeLayer.property("ADBE Root Vectors Group");',
    '    var group = contents.addProperty("ADBE Vector Group");',
    '    var vectors = group.property("ADBE Vectors Group");',
    '    var rect = vectors.addProperty("ADBE Vector Shape - Rect");',
    '    rect.property("ADBE Vector Rect Size").setValue([mbGridBoxSize, mbGridBoxSize]);',
    '    var fill = vectors.addProperty("ADBE Vector Graphic - Fill");',
    "    fill.property(\"ADBE Vector Fill Color\").setValue(mbGridPalette[layerIndex % mbGridPalette.length]);",
    '    shapeLayer.property("ADBE Transform Group").property("ADBE Position").setValue([',
    "      mbGridStartX + col * mbGridSpacingX,",
    "      mbGridStartY + row * mbGridSpacingY",
    "    ]);",
    '    mbRecordTarget("layer:" + shapeLayer.name);',
    "  }",
    "}",
    'mbResult.message = "Created a deterministic shape grid in the active composition."; ',
    'mbRecordAction("create_shape_grid");',
  ].join("\n");
}

function renderApplyPalette(action: ApplyPaletteToSelectedLayersAction) {
  return [
    "comp = mbRequireComp();",
    "selectedLayers = mbRequireSelectedLayers(comp);",
    `var mbPalette = ${JSON.stringify(normalizePalette(action.palette))};`,
    "for (var i = 0; i < selectedLayers.length; i++) {",
    "  var layer = selectedLayers[i];",
    "  var color = mbPalette[i % mbPalette.length];",
    "  if (layer instanceof ShapeLayer) {",
    '    var contents = layer.property("ADBE Root Vectors Group");',
    "    for (var j = 1; j <= contents.numProperties; j++) {",
    '      var vectorGroup = contents.property(j).property("ADBE Vectors Group");',
    "      if (!vectorGroup) {",
    "        continue;",
    "      }",
    "      for (var k = 1; k <= vectorGroup.numProperties; k++) {",
    "        if (vectorGroup.property(k).matchName === \"ADBE Vector Graphic - Fill\") {",
    '          vectorGroup.property(k).property("ADBE Vector Fill Color").setValue(color);',
    "        }",
    "      }",
    "    }",
    "  } else if (layer instanceof TextLayer) {",
    '    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");',
    "    var textDoc = textProp.value;",
    "    textDoc.applyFill = true;",
    "    textDoc.fillColor = color;",
    "    textProp.setValue(textDoc);",
    "  }",
    '  mbRecordTarget("layer:" + layer.name);',
    "}",
    'mbResult.message = "Applied a deterministic palette to the selected layers."; ',
    'mbRecordAction("apply_palette_to_selected_layers");',
  ].join("\n");
}

function renderAction(action: ActionPlanAction, context: AEContext) {
  switch (action.type) {
    case "ensure_active_comp":
      return renderEnsureActiveComp();
    case "offset_selected_layers":
      return renderOffsetSelectedLayers(action, context);
    case "convert_selected_layers_to_3d":
      return renderConvertSelectedLayersTo3D();
    case "apply_expression_to_selected_property":
      return renderApplyExpression(action);
    case "animate_overshoot_scale_on_selected_layers":
      return renderOvershootScale(action);
    case "ensure_camera":
      return renderEnsureCamera(action, context);
    case "animate_camera_push":
      return renderAnimateCameraPush(action, context);
    case "create_shape_grid":
      return renderCreateShapeGrid(action);
    case "apply_palette_to_selected_layers":
      return renderApplyPalette(action);
  }
}

export function renderActionPlan(plan: ActionPlan, context: AEContext) {
  const actionBlocks = plan.actions.map((action) => renderAction(action, context)).join("\n\n");
  const warnings = plan.warnings.map((warning) => asJsString(warning)).join(", ");

  return [
    "(function () {",
    "  var mbResult = {",
    '    status: "ok",',
    `    summary: ${asJsString(plan.summary)},`,
    '    message: "Plan executed successfully.",',
    `    warnings: [${warnings}],`,
    "    actionsExecuted: [],",
    "    affectedTargets: []",
    "  };",
    "  var undoStarted = false;",
    "  var comp = null;",
    "  var selectedLayers = null;",
    "  var mbCamera = null;",
    "",
    "  function mbRecordAction(name) {",
    "    mbResult.actionsExecuted.push(name);",
    "  }",
    "",
    "  function mbRecordTarget(target) {",
    "    for (var i = 0; i < mbResult.affectedTargets.length; i++) {",
    "      if (mbResult.affectedTargets[i] === target) {",
    "        return;",
    "      }",
    "    }",
    "    mbResult.affectedTargets.push(target);",
    "  }",
    "",
    "  function mbRequireComp() {",
    "    var activeItem = app.project ? app.project.activeItem : null;",
    "    if (!(activeItem && activeItem instanceof CompItem)) {",
    '      throw new Error("Select or open a composition first.");',
    "    }",
    "    return activeItem;",
    "  }",
    "",
    "  function mbRequireSelectedLayers(targetComp) {",
    "    var selected = targetComp.selectedLayers;",
    "    if (!selected.length) {",
    '      throw new Error("Select one or more layers first.");',
    "    }",
    "    return selected;",
    "  }",
    "",
    "  function mbFindCamera(targetComp) {",
    "    for (var i = 1; i <= targetComp.numLayers; i++) {",
    "      if (targetComp.layer(i) instanceof CameraLayer) {",
    "        return targetComp.layer(i);",
    "      }",
    "    }",
    "    return null;",
    "  }",
    "",
    "  function mbEnsureCamera(targetComp, name, position, pointOfInterest, autoOrient) {",
    "    var camera = mbFindCamera(targetComp);",
    "    if (!camera) {",
    "      camera = targetComp.layers.addCamera(name, [position[0], position[1]]);",
    "    }",
    '    var positionProperty = camera.property("ADBE Transform Group").property("ADBE Position");',
    '    var poiProperty = camera.property("ADBE Transform Group").property("ADBE Point of Interest");',
    "    positionProperty.setValue(position);",
    "    poiProperty.setValue(pointOfInterest);",
    "    camera.autoOrient = autoOrient;",
    "    return camera;",
    "  }",
    "",
    "  function mbUniformScaleValue(scaleProperty, value) {",
    "    var current = scaleProperty.value;",
    "    if (current && current.length === 3) {",
    "      return [value, value, value];",
    "    }",
    "    return [value, value];",
    "  }",
    "",
    "  function mbEasePair(scaleProperty, ease) {",
    "    var current = scaleProperty.value;",
    "    if (current && current.length === 3) {",
    "      return [ease, ease, ease];",
    "    }",
    "    return [ease, ease];",
    "  }",
    "",
    "  try {",
    '    app.beginUndoGroup("Motion Buddy");',
    "    undoStarted = true;",
    actionBlocks
      ? actionBlocks
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")
      : '    mbResult.message = "No executable actions were produced."; ',
    "  } catch (error) {",
    '    mbResult.status = "error";',
    "    mbResult.message = error && error.toString ? error.toString() : String(error);",
    "  } finally {",
    "    if (undoStarted) {",
    "      try {",
    "        app.endUndoGroup();",
    "      } catch (_undoError) {}",
    "    }",
    "    $.global.__motionBuddyResult = mbResult;",
    "  }",
    "",
    '  if (mbResult.status !== "ok") {',
    "    throw new Error(mbResult.message);",
    "  }",
    "})();",
  ].join("\n");
}
