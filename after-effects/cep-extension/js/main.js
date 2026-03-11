/* global CSInterface, SystemPath */

(function () {
  "use strict";

  var DEFAULT_BACKEND_URL = "http://127.0.0.1:3030/motion-buddy/generate";
  var panelState = {
    busy: false,
    lastExportResult: null
  };

  var dom = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheDom();
    bindEvents();
    bootPanel();
  });

  function cacheDom() {
    dom.form = document.getElementById("motionBuddyForm");
    dom.promptInput = document.getElementById("promptInput");
    dom.generateButton = document.getElementById("generateButton");
    dom.clearLogButton = document.getElementById("clearLogButton");
    dom.logConsole = document.getElementById("logConsole");
    dom.statusPill = document.getElementById("statusPill");
    dom.statusText = document.getElementById("statusText");
  }

  function bindEvents() {
    dom.form.addEventListener("submit", handleGenerateAndApply);
    dom.clearLogButton.addEventListener("click", function () {
      dom.logConsole.textContent = "Ready.";
    });
  }

  function bootPanel() {
    if (!hasCepRuntime()) {
      setStatus("error", "Missing CSInterface.js");
      appendLog(
        "CSInterface.js was not found. Copy the official Adobe file into ./js/vendor/CSInterface.js before loading the panel."
      );
      dom.generateButton.disabled = true;
      return;
    }

    setStatus("idle", "Idle");
    appendLog("Panel initialized. Waiting for a prompt.");
  }

  function hasCepRuntime() {
    return typeof window.CSInterface === "function";
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
    } catch (error) {
      return {
        ok: false,
        message: "Host returned invalid JSON: " + rawValue,
        rawValue: rawValue
      };
    }
  }

  async function handleGenerateAndApply(event) {
    event.preventDefault();

    if (panelState.busy) {
      return;
    }

    var promptText = dom.promptInput.value.trim();
    if (!promptText) {
      setStatus("error", "Prompt required");
      appendLog("Enter a prompt before running Motion Buddy.");
      dom.promptInput.focus();
      return;
    }

    try {
      panelState.busy = true;
      dom.generateButton.disabled = true;
      setStatus("working", "Exporting context");
      appendLog("Step A: exporting After Effects context...");

      panelState.lastExportResult = await runHostFunction("exportContext", []);
      appendLog("Context written to " + panelState.lastExportResult.contextPath);

      setStatus("working", "Calling backend");
      appendLog("Step B: sending prompt to the local Motion Buddy backend...");

      var backendResult = await callMotionBuddyBackend(promptText);
      appendLog("Backend completed. Generated script: " + backendResult.generatedScriptPath);

      setStatus("working", "Applying script");
      appendLog("Step C: applying generated JSX inside After Effects...");

      var applyResult = await runHostFunction("applyGeneratedScript", [backendResult.generatedScriptPath]);
      appendLog(applyResult.message || "Generated script applied.");

      setStatus("success", "Done");
    } catch (error) {
      setStatus("error", "Failed");
      appendLog(error && error.message ? error.message : String(error));
    } finally {
      panelState.busy = false;
      dom.generateButton.disabled = false;
    }
  }

  async function callMotionBuddyBackend(promptText) {
    if (!panelState.lastExportResult) {
      throw new Error("No exported context is available for the backend call.");
    }

    // Replace this fetch call with your existing local server or CLI bridge.
    // Expected response shape:
    // {
    //   "generatedScriptPath": "/absolute/path/to/generated-script.jsx"
    // }
    var response = await fetch(DEFAULT_BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: promptText,
        contextPath: panelState.lastExportResult.contextPath,
        exchangeRoot: panelState.lastExportResult.exchangeRoot
      })
    });

    if (!response.ok) {
      throw new Error("Backend request failed with HTTP " + response.status + ".");
    }

    var payload = await response.json();
    var generatedScriptPath = payload.generatedScriptPath || payload.scriptPath;

    if (!generatedScriptPath) {
      throw new Error("Backend response did not include generatedScriptPath.");
    }

    return {
      generatedScriptPath: generatedScriptPath,
      raw: payload
    };

    /*
    // Alternative shell-based approach when you want to call a local CLI instead.
    // Keep --enable-nodejs and --mixed-context in manifest.xml if you use this.
    var childProcess = window.cep_node.require("child_process");
    var execFile = childProcess.execFile;
    return new Promise(function (resolve, reject) {
      execFile(
        "/absolute/path/to/motion-buddy-cli",
        [
          "--prompt",
          promptText,
          "--context",
          panelState.lastExportResult.contextPath
        ],
        function (error, stdout) {
          if (error) {
            reject(error);
            return;
          }

          try {
            resolve(JSON.parse(stdout));
          } catch (parseError) {
            reject(parseError);
          }
        }
      );
    });
    */
  }

  function setStatus(state, label) {
    dom.statusPill.setAttribute("data-state", state);
    dom.statusText.textContent = label;
  }

  function appendLog(message) {
    var timestamp = new Date().toLocaleTimeString();
    var nextLine = "[" + timestamp + "] " + message;
    dom.logConsole.textContent = dom.logConsole.textContent === "Ready."
      ? nextLine
      : dom.logConsole.textContent + "\n" + nextLine;
    dom.logConsole.scrollTop = dom.logConsole.scrollHeight;
  }
})();
