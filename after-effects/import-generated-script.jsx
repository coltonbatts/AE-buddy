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
  file.encoding = "UTF-8";
  file.open("w");
  file.write(mbToJson(payload));
  file.close();
}

function mbEnsureFolder(folder) {
  if (!folder.exists) {
    folder.create();
  }
}

(function () {
  var scriptFile = File($.fileName);
  var rootFolder = scriptFile.parent.parent;
  var exchangeFolder = new Folder(rootFolder.fsName + "/.motion-buddy");
  var outFolder = new Folder(exchangeFolder.fsName + "/out");
  var generatedScriptFile = new File(outFolder.fsName + "/generated-script.jsx");
  var resultFile = new File(outFolder.fsName + "/execution-result.json");

  mbEnsureFolder(exchangeFolder);
  mbEnsureFolder(outFolder);

  if (!generatedScriptFile.exists) {
    mbWriteResult(resultFile, {
      status: "error",
      message: "No generated-script.jsx file was found.",
      executedAt: new Date().toUTCString(),
      result: null
    });
    alert("Motion Buddy could not find a generated script.");
    return;
  }

  $.global.__motionBuddyResult = null;

  try {
    $.evalFile(generatedScriptFile);
    mbWriteResult(resultFile, {
      status: "ok",
      message: "Generated script executed successfully.",
      executedAt: new Date().toUTCString(),
      result: $.global.__motionBuddyResult
    });
    alert("Motion Buddy executed the generated script.");
  } catch (error) {
    var structuredResult = $.global.__motionBuddyResult || null;
    var message = error && error.toString ? error.toString() : String(error);
    mbWriteResult(resultFile, {
      status: "error",
      message: message,
      executedAt: new Date().toUTCString(),
      result: structuredResult
    });
    alert("Motion Buddy script failed:\n" + message);
  }
})();
