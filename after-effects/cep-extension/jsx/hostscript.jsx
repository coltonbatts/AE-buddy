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

function mbRespond(ok, message, extra) {
  var payload = extra || {};
  payload.ok = ok;
  payload.message = message;
  return mbToJson(payload);
}

function mbNormalizePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

var MotionBuddyCep = MotionBuddyCep || {};

MotionBuddyCep.ping = function () {
  return mbRespond(true, "Motion Buddy CEP bridge is ready.", {
    host: app.name,
    version: app.version
  });
};

MotionBuddyCep.executeImport = function (importScriptPath, expectedRunId, suppressAlerts) {
  var importFile = new File(mbNormalizePath(importScriptPath));
  var previousExpectedRunId = $.global.__motionBuddyExpectedRunId;
  var previousSuppressAlerts = $.global.__motionBuddySuppressAlerts;

  try {
    if (!importScriptPath) {
      throw new Error("No import-generated-script.jsx path was provided.");
    }

    if (!importFile.exists) {
      throw new Error("Motion Buddy import bridge was not found at: " + importFile.fsName);
    }

    $.global.__motionBuddyExpectedRunId = expectedRunId || null;
    $.global.__motionBuddySuppressAlerts = suppressAlerts === true;

    $.evalFile(importFile);

    return mbRespond(true, "Motion Buddy import bridge executed.", {
      runId: expectedRunId || null,
      importScriptPath: importFile.fsName
    });
  } catch (error) {
    return mbRespond(false, error && error.toString ? error.toString() : String(error), {
      runId: expectedRunId || null,
      importScriptPath: importFile.fsName
    });
  } finally {
    $.global.__motionBuddyExpectedRunId = previousExpectedRunId;
    $.global.__motionBuddySuppressAlerts = previousSuppressAlerts;
  }
};
