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

function mbWriteResult(file, payload) {
  var tempFile = new File(file.fsName + ".tmp");
  tempFile.encoding = "UTF-8";

  if (!tempFile.open("w")) {
    throw new Error("Could not open temporary result file.");
  }

  tempFile.write(mbToJson(payload));
  tempFile.close();

  if (file.exists) {
    file.remove();
  }

  if (!tempFile.rename(file.name)) {
    throw new Error("Could not finalize execution result write.");
  }
}

function mbReadText(file) {
  if (!file.exists) {
    return null;
  }

  file.encoding = "UTF-8";
  if (!file.open("r")) {
    return null;
  }

  var contents = file.read();
  file.close();
  return contents;
}

function mbReadJson(file) {
  var contents = mbReadText(file);
  if (contents === null) {
    return null;
  }

  try {
    return eval("(" + contents + ")");
  } catch (_error) {
    return null;
  }
}

function mbEnsureFolder(folder) {
  if (!folder.exists) {
    folder.create();
  }
}

function mbAlertUnlessSuppressed(message) {
  if ($.global.__motionBuddySuppressAlerts === true) {
    return;
  }

  alert(message);
}

(function () {
  var scriptFile = File($.fileName);
  var rootFolder = scriptFile.parent.parent;
  var exchangeFolder = new Folder(rootFolder.fsName + "/.motion-buddy");
  var outFolder = new Folder(exchangeFolder.fsName + "/out");
  var generatedScriptFile = new File(outFolder.fsName + "/generated-script.jsx");
  var receiptFile = new File(outFolder.fsName + "/receipt.json");
  var resultFile = new File(outFolder.fsName + "/execution-result.json");
  var receipt = mbReadJson(receiptFile);
  var expectedRunId =
    typeof $.global.__motionBuddyExpectedRunId === "string" && $.global.__motionBuddyExpectedRunId.length
      ? $.global.__motionBuddyExpectedRunId
      : null;
  var runId = receipt && typeof receipt.runId === "string" && receipt.runId.length ? receipt.runId : null;
  var resultRunId = expectedRunId || runId;
  var undoStarted = false;

  mbEnsureFolder(exchangeFolder);
  mbEnsureFolder(outFolder);

  if (!runId) {
    if (resultRunId) {
      mbWriteResult(resultFile, {
        runId: resultRunId,
        status: "error",
        message: "Motion Buddy could not find a valid receipt.json for the requested run.",
        executedAt: new Date().toUTCString(),
        result: null
      });
    }
    mbAlertUnlessSuppressed("Motion Buddy could not find a valid receipt.json for the current run.");
    return;
  }

  if (expectedRunId && expectedRunId !== runId) {
    mbWriteResult(resultFile, {
      runId: expectedRunId,
      status: "error",
      message: "Motion Buddy receipt runId did not match the requested run. Expected " + expectedRunId + " but found " + runId + ".",
      executedAt: new Date().toUTCString(),
      result: null
    });
    mbAlertUnlessSuppressed("Motion Buddy refused to execute because the runId did not match the requested run.");
    return;
  }

  if (!generatedScriptFile.exists) {
    mbWriteResult(resultFile, {
      runId: resultRunId,
      status: "error",
      message: "No generated-script.jsx file was found.",
      executedAt: new Date().toUTCString(),
      result: null
    });
    mbAlertUnlessSuppressed("Motion Buddy could not find a generated script.");
    return;
  }

  $.global.__motionBuddyResult = null;
  $.global.__motionBuddyRunId = resultRunId;

  try {
    app.beginUndoGroup("Motion Buddy Action");
    undoStarted = true;
    $.evalFile(generatedScriptFile);
    mbWriteResult(resultFile, {
      runId: resultRunId,
      status: "ok",
      message: "Generated script executed successfully.",
      executedAt: new Date().toUTCString(),
      result: $.global.__motionBuddyResult
    });
    mbAlertUnlessSuppressed("Motion Buddy executed the generated script.");
  } catch (error) {
    var structuredResult = $.global.__motionBuddyResult || null;
    var message = error && error.toString ? error.toString() : String(error);
    mbWriteResult(resultFile, {
      runId: resultRunId,
      status: "error",
      message: message,
      executedAt: new Date().toUTCString(),
      result: structuredResult
    });
    mbAlertUnlessSuppressed("Motion Buddy script failed:\n" + message);
  } finally {
    if (undoStarted) {
      try {
        app.endUndoGroup();
      } catch (_undoError) {}
    }
  }
})();
