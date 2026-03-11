/* global CSInterface, SystemPath */

(function () {
  "use strict";

  var DEFAULT_PORT = 9123;
  var EXECUTE_PATH = "/motion-buddy/execute";
  var HEALTH_PATH = "/motion-buddy/health";
  var MAX_BODY_BYTES = 16 * 1024;

  var state = {
    server: null,
    port: DEFAULT_PORT,
    busy: false,
    queue: Promise.resolve(),
    lastRunId: null
  };

  var dom = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheDom();
    bindEvents();
    bootPanel();
  });

  function cacheDom() {
    dom.statusPill = document.getElementById("statusPill");
    dom.statusText = document.getElementById("statusText");
    dom.endpointValue = document.getElementById("endpointValue");
    dom.lastRunValue = document.getElementById("lastRunValue");
    dom.restartButton = document.getElementById("restartServerButton");
    dom.clearLogButton = document.getElementById("clearLogButton");
    dom.logConsole = document.getElementById("logConsole");
  }

  function bindEvents() {
    dom.restartButton.addEventListener("click", function () {
      restartServer();
    });

    dom.clearLogButton.addEventListener("click", function () {
      dom.logConsole.textContent = "Bridge booting...";
    });
  }

  async function bootPanel() {
    if (!hasCepRuntime()) {
      setStatus("error", "CSInterface missing");
      appendLog("Copy Adobe's CSInterface.js into ./js/vendor/CSInterface.js before loading the panel.");
      dom.restartButton.disabled = true;
      return;
    }

    if (!hasNodeRuntime()) {
      setStatus("error", "Node runtime missing");
      appendLog("This extension requires CEP Node integration. Confirm --enable-nodejs and --mixed-context are enabled.");
      dom.restartButton.disabled = true;
      return;
    }

    setStatus("working", "Booting bridge");
    updateMeta();

    try {
      var pingResult = await runHostFunction("MotionBuddyCep.ping", []);
      appendLog(pingResult.message + " Host: " + pingResult.host + " " + pingResult.version + ".");
      startServer();
    } catch (error) {
      setStatus("error", "After Effects unavailable");
      appendLog(error && error.message ? error.message : String(error));
    }
  }

  function hasCepRuntime() {
    return typeof window.CSInterface === "function";
  }

  function hasNodeRuntime() {
    return Boolean(window.cep_node && typeof window.cep_node.require === "function");
  }

  function getNodeRequire() {
    return window.cep_node.require;
  }

  function getCsInterface() {
    return new CSInterface();
  }

  function getHostScriptPath() {
    var extensionRoot = getCsInterface().getSystemPath(SystemPath.EXTENSION);
    return extensionRoot.replace(/\\/g, "/") + "/jsx/hostscript.jsx";
  }

  function buildHostScriptCall(functionName, args) {
    var serializedArgs = (args || []).map(function (arg) {
      return JSON.stringify(arg);
    });

    return "$.evalFile(" + JSON.stringify(getHostScriptPath()) + ");" +
      functionName + "(" + serializedArgs.join(", ") + ");";
  }

  function evalScript(script) {
    return new Promise(function (resolve, reject) {
      getCsInterface().evalScript(script, function (result) {
        if (result === "EvalScript error.") {
          reject(new Error("After Effects returned EvalScript error."));
          return;
        }

        resolve(result);
      });
    });
  }

  async function runHostFunction(functionName, args) {
    var rawResult = await evalScript(buildHostScriptCall(functionName, args));
    var parsedResult = parseJsonResult(rawResult);

    if (!parsedResult.ok) {
      throw new Error(parsedResult.message || ("Host function failed: " + functionName));
    }

    return parsedResult;
  }

  function parseJsonResult(rawValue) {
    if (typeof rawValue !== "string") {
      return {
        ok: false,
        message: "Host returned a non-string response.",
        rawValue: rawValue
      };
    }

    try {
      return JSON.parse(rawValue);
    } catch (_error) {
      return {
        ok: false,
        message: "Host returned invalid JSON: " + rawValue,
        rawValue: rawValue
      };
    }
  }

  function startServer() {
    if (state.server) {
      return;
    }

    var http = getNodeRequire()("http");

    state.server = http.createServer(function (request, response) {
      void handleHttpRequest(request, response);
    });

    state.server.on("error", function (error) {
      setStatus("error", "Server error");
      appendLog(error && error.message ? error.message : String(error));
    });

    state.server.listen(state.port, "127.0.0.1", function () {
      setStatus("ready", "Listening");
      updateMeta();
      appendLog("Listening on http://127.0.0.1:" + state.port + EXECUTE_PATH);
    });
  }

  function stopServer() {
    return new Promise(function (resolve) {
      if (!state.server) {
        resolve();
        return;
      }

      var activeServer = state.server;
      state.server = null;
      activeServer.close(function () {
        updateMeta();
        resolve();
      });
    });
  }

  async function restartServer() {
    dom.restartButton.disabled = true;
    appendLog("Restarting Motion Buddy CEP bridge...");
    await stopServer();
    startServer();
    dom.restartButton.disabled = false;
  }

  async function handleHttpRequest(request, response) {
    var pathname = String((request.url || "").split("?")[0]);

    if (request.method === "GET" && pathname === HEALTH_PATH) {
      sendJson(response, 200, {
        ok: true,
        message: "Motion Buddy CEP bridge is healthy.",
        endpoint: "http://127.0.0.1:" + state.port + EXECUTE_PATH,
        runId: state.lastRunId
      });
      return;
    }

    if (request.method !== "POST" || pathname !== EXECUTE_PATH) {
      sendJson(response, 404, {
        ok: false,
        message: "Unknown Motion Buddy CEP route."
      });
      return;
    }

    try {
      var payload = await readJsonBody(request);
      validateExecutePayload(payload);

      var result = await enqueueExecution(payload);
      sendJson(response, 200, result);
    } catch (error) {
      var message = error && error.message ? error.message : String(error);
      appendLog("Request failed: " + message);
      sendJson(response, error && error.httpStatus ? error.httpStatus : 400, {
        ok: false,
        message: message
      });
    }
  }

  function readJsonBody(request) {
    return new Promise(function (resolve, reject) {
      var chunks = [];
      var size = 0;

      request.on("data", function (chunk) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error("Request body exceeded the Motion Buddy CEP limit."));
          request.destroy();
          return;
        }

        chunks.push(chunk);
      });

      request.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        if (!raw) {
          reject(new Error("CEP bridge request body was empty."));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error("CEP bridge received invalid JSON: " + error.message));
        }
      });

      request.on("error", function (error) {
        reject(error);
      });
    });
  }

  function validateExecutePayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("CEP bridge payload must be an object.");
    }

    if (typeof payload.runId !== "string" || !payload.runId.trim()) {
      throw new Error("CEP bridge payload requires a non-empty runId.");
    }

    if (typeof payload.importScriptPath !== "string" || !payload.importScriptPath.trim()) {
      throw new Error("CEP bridge payload requires importScriptPath.");
    }
  }

  function enqueueExecution(payload) {
    state.queue = state.queue.then(function () {
      return executeImport(payload);
    });

    return state.queue;
  }

  async function executeImport(payload) {
    state.busy = true;
    updateMeta();
    setStatus("working", "Executing");
    appendLog("Executing run " + payload.runId + " via " + payload.importScriptPath);

    try {
      var result = await runHostFunction("MotionBuddyCep.executeImport", [
        payload.importScriptPath,
        payload.runId,
        payload.suppressAlerts !== false
      ]);

      state.lastRunId = payload.runId;
      updateMeta();
      setStatus("ready", "Listening");
      appendLog(result.message || ("Run " + payload.runId + " dispatched to After Effects."));

      return {
        ok: true,
        message: result.message || "Motion Buddy CEP bridge executed the import script.",
        runId: payload.runId,
        endpoint: "http://127.0.0.1:" + state.port + EXECUTE_PATH
      };
    } catch (error) {
      setStatus("error", "Execution failed");
      error.httpStatus = 500;
      throw error;
    } finally {
      state.busy = false;
      updateMeta();
    }
  }

  function updateMeta() {
    dom.endpointValue.textContent = "http://127.0.0.1:" + state.port + EXECUTE_PATH;
    dom.lastRunValue.textContent = state.lastRunId || (state.busy ? "Waiting..." : "None");
  }

  function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(payload));
  }

  function setStatus(stateName, label) {
    dom.statusPill.setAttribute("data-state", stateName);
    dom.statusText.textContent = label;
  }

  function appendLog(message) {
    var timestamp = new Date().toLocaleTimeString();
    var line = "[" + timestamp + "] " + message;

    dom.logConsole.textContent = dom.logConsole.textContent === "Bridge booting..."
      ? line
      : dom.logConsole.textContent + "\n" + line;
    dom.logConsole.scrollTop = dom.logConsole.scrollHeight;
  }
})();
