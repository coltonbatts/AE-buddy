#target aftereffects

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

function mbStringify(value) {
  return mbToJson(value);
}

function mbRespond(ok, message, extra) {
  var payload = extra || {};
  payload.ok = ok;
  payload.message = message;
  return mbStringify(payload);
}

function mbGetExchangeFolder() {
  // CEP panels live in the Adobe extensions directory, so use a stable user-data
  // folder instead of assuming the extension sits inside your project repo.
  var motionBuddyRoot = new Folder(Folder.userData.fsName + "/Motion Buddy");
  var exchangeFolder = new Folder(motionBuddyRoot.fsName + "/.motion-buddy");

  mbEnsureFolder(motionBuddyRoot);
  mbEnsureFolder(exchangeFolder);

  return exchangeFolder;
}

function mbCollectSelectedLayerNames(comp) {
  var names = [];
  if (!comp || !(comp instanceof CompItem)) {
    return names;
  }

  for (var i = 0; i < comp.selectedLayers.length; i++) {
    names.push(comp.selectedLayers[i].name);
  }

  return names;
}

function mbWriteFile(file, contents) {
  file.encoding = "UTF-8";

  if (!file.open("w")) {
    throw new Error("Unable to open file for writing: " + file.fsName);
  }

  file.write(contents);
  file.close();
}

function exportContext() {
  try {
    var exchangeFolder = mbGetExchangeFolder();
    var contextFile = new File(exchangeFolder.fsName + "/context.json");
    var project = app.project;
    var activeItem = project ? project.activeItem : null;

    // Replace this placeholder payload with your existing export logic.
    // The panel only needs a file written to disk and an absolute contextPath.
    var contextPayload = {
      exportedAt: new Date().toUTCString(),
      projectName: project && project.file ? project.file.displayName : "Unsaved Project",
      activeCompName: activeItem && activeItem instanceof CompItem ? activeItem.name : null,
      selectedLayerNames: mbCollectSelectedLayerNames(activeItem),
      note: "Replace exportContext() in jsx/hostscript.jsx with your full AE context exporter."
    };

    mbWriteFile(contextFile, mbStringify(contextPayload));

    return mbRespond(true, "Context exported successfully.", {
      contextPath: contextFile.fsName,
      exchangeRoot: exchangeFolder.fsName
    });
  } catch (error) {
    return mbRespond(false, error.toString(), {});
  }
}

function applyGeneratedScript(scriptPath) {
  try {
    if (!scriptPath) {
      throw new Error("No generated script path was provided.");
    }

    var generatedScript = new File(scriptPath);
    if (!generatedScript.exists) {
      throw new Error("Generated script not found at: " + generatedScript.fsName);
    }

    // Replace or extend this with your existing import logic if you need
    // additional bookkeeping around execution results.
    $.evalFile(generatedScript);

    return mbRespond(true, "Generated script executed successfully.", {
      scriptPath: generatedScript.fsName
    });
  } catch (error) {
    return mbRespond(false, error.toString(), {
      scriptPath: scriptPath || null
    });
  }
}
