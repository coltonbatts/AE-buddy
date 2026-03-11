function mbEscapeString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function mbToJson(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  var valueType = typeof value;

  if (valueType === "string") {
    return '"' + mbEscapeString(value) + '"';
  }

  if (valueType === "number" || valueType === "boolean") {
    return String(value);
  }

  if (value instanceof Array) {
    var items = [];
    for (var i = 0; i < value.length; i++) {
      items.push(mbToJson(value[i]));
    }
    return "[" + items.join(",") + "]";
  }

  var pairs = [];
  for (var key in value) {
    if (value.hasOwnProperty(key)) {
      pairs.push('"' + mbEscapeString(key) + '":' + mbToJson(value[key]));
    }
  }

  return "{" + pairs.join(",") + "}";
}

function mbEnsureFolder(folder) {
  if (!folder.exists) {
    folder.create();
  }
}

function mbAtomicWriteJson(file, payload) {
  var tempFile = new File(file.fsName + ".tmp");
  tempFile.encoding = "UTF-8";

  if (!tempFile.open("w")) {
    throw new Error("Could not open temporary file for writing: " + tempFile.fsName);
  }

  tempFile.write(mbToJson(payload));
  tempFile.close();

  if (file.exists) {
    file.remove();
  }

  if (!tempFile.rename(file.name)) {
    throw new Error("Could not finalize file write for: " + file.fsName);
  }
}

function mbLayerType(layer) {
  if (layer instanceof TextLayer) {
    return "text";
  }
  if (layer instanceof ShapeLayer) {
    return "shape";
  }
  if (layer instanceof CameraLayer) {
    return "camera";
  }
  if (layer instanceof LightLayer) {
    return "light";
  }
  if (layer.nullLayer) {
    return "null";
  }
  if (layer.source && layer.source instanceof CompItem) {
    return "precomp";
  }
  if (layer.source && layer.source.mainSource && layer.source.mainSource.color) {
    return "solid";
  }
  if (layer.source) {
    return "footage";
  }
  return "unknown";
}

function mbSelectedProperties(layer) {
  var names = [];
  for (var i = 0; i < layer.selectedProperties.length; i++) {
    names.push(layer.selectedProperties[i].name);
  }
  return names;
}

function mbCountSelectedKeys(property) {
  if (!property) {
    return 0;
  }

  try {
    if (property.selectedKeys && property.selectedKeys.length) {
      return property.selectedKeys.length;
    }
  } catch (_error) {}

  var count = 0;

  try {
    if (property.numProperties && property.numProperties > 0) {
      for (var i = 1; i <= property.numProperties; i++) {
        count += mbCountSelectedKeys(property.property(i));
      }
    }
  } catch (_nestedError) {}

  return count;
}

function mbSelectedKeyframeCount(layer) {
  var total = 0;

  for (var i = 0; i < layer.selectedProperties.length; i++) {
    total += mbCountSelectedKeys(layer.selectedProperties[i]);
  }

  return total;
}

function mbTextValue(layer) {
  try {
    if (layer instanceof TextLayer) {
      return layer.property("ADBE Text Properties").property("ADBE Text Document").value.text;
    }
  } catch (_error) {}
  return "";
}

function mbPropertyValue(property) {
  try {
    if (!property) {
      return null;
    }
    var value = property.value;
    if (value instanceof Array) {
      var output = [];
      for (var i = 0; i < value.length; i++) {
        output.push(Number(value[i]));
      }
      return output;
    }
    if (typeof value === "number") {
      return Number(value);
    }
  } catch (_error) {}
  return null;
}

function mbTransformSnapshot(layer) {
  var transform = layer.property("ADBE Transform Group");
  if (!transform) {
    return {};
  }

  return {
    anchorPoint: mbPropertyValue(transform.property("ADBE Anchor Point")),
    position: mbPropertyValue(transform.property("ADBE Position")),
    scale: mbPropertyValue(transform.property("ADBE Scale")),
    opacity: mbPropertyValue(transform.property("ADBE Opacity")),
    rotation: mbPropertyValue(transform.property("ADBE Rotate Z")),
    orientation: mbPropertyValue(transform.property("ADBE Orientation")),
    xRotation: mbPropertyValue(transform.property("ADBE Rotate X")),
    yRotation: mbPropertyValue(transform.property("ADBE Rotate Y")),
    zRotation: mbPropertyValue(transform.property("ADBE Rotate Z"))
  };
}

function mbHasCamera(comp) {
  for (var i = 1; i <= comp.numLayers; i++) {
    if (comp.layer(i) instanceof CameraLayer) {
      return true;
    }
  }
  return false;
}

function mbActiveCameraName(comp) {
  try {
    return comp.activeCamera ? comp.activeCamera.name : null;
  } catch (_error) {
    return null;
  }
}

(function () {
  var project = app.project;
  if (!project) {
    alert("Open an After Effects project first.");
    return;
  }

  var scriptFile = File($.fileName);
  var rootFolder = scriptFile.parent.parent;
  var exchangeFolder = new Folder(rootFolder.fsName + "/.motion-buddy");
  var contextFolder = new Folder(exchangeFolder.fsName + "/context");
  var outputFile = new File(contextFolder.fsName + "/ae-context.json");

  mbEnsureFolder(exchangeFolder);
  mbEnsureFolder(contextFolder);

  var context = {
    exportedAt: new Date().toISOString ? new Date().toISOString() : new Date().toUTCString(),
    projectName: project.file ? project.file.displayName : "Unsaved Project",
    activeComp: null,
    selectedLayers: [],
    notes: []
  };

  if (project.activeItem && project.activeItem instanceof CompItem) {
    var comp = project.activeItem;
    context.activeComp = {
      name: comp.name,
      width: comp.width,
      height: comp.height,
      duration: comp.duration,
      frameRate: comp.frameRate,
      workAreaStart: comp.workAreaStart,
      workAreaDuration: comp.workAreaDuration,
      displayStartTime: comp.displayStartTime,
      currentTime: comp.time,
      numLayers: comp.numLayers,
      hasCamera: mbHasCamera(comp),
      activeCameraName: mbActiveCameraName(comp),
      backgroundColor: [comp.bgColor[0], comp.bgColor[1], comp.bgColor[2]]
    };

    for (var i = 0; i < comp.selectedLayers.length; i++) {
      var layer = comp.selectedLayers[i];
      context.selectedLayers.push({
        index: layer.index,
        name: layer.name,
        type: mbLayerType(layer),
        threeD: layer.threeDLayer,
        inPoint: layer.inPoint,
        outPoint: layer.outPoint,
        startTime: layer.startTime,
        parentName: layer.parent ? layer.parent.name : null,
        enabled: layer.enabled,
        locked: layer.locked,
        shy: layer.shy,
        label: layer.label,
        selectedProperties: mbSelectedProperties(layer),
        selectedKeyframeCount: mbSelectedKeyframeCount(layer),
        transform: mbTransformSnapshot(layer),
        textValue: mbTextValue(layer)
      });
    }

    if (!comp.selectedLayers.length) {
      context.notes.push("The active composition has no selected layers.");
    }
  } else {
    context.notes.push("No active composition is open.");
  }

  mbAtomicWriteJson(outputFile, context);

  alert("Motion Buddy exported context to:\n" + outputFile.fsName);
})();
