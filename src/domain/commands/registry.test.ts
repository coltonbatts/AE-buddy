import assert from "node:assert/strict";
import test from "node:test";

import { parseAeContext } from "../../shared/ae-context.js";
import { searchMotionRegistry } from "./registry.js";

function createContext(overrides: Record<string, unknown> = {}) {
  return parseAeContext({
    exportedAt: new Date().toISOString(),
    projectName: "Test Project",
    activeComp: {
      name: "Main",
      width: 1920,
      height: 1080,
      duration: 10,
      frameRate: 24,
      workAreaStart: 0,
      workAreaDuration: 10,
      displayStartTime: 0,
      currentTime: 2,
      numLayers: 3,
      hasCamera: false,
      activeCameraName: null,
      backgroundColor: [0, 0, 0],
    },
    selectedLayers: [
      {
        index: 1,
        name: "Title",
        type: "text",
        threeD: false,
        inPoint: 0,
        outPoint: 5,
        startTime: 0,
        parentName: null,
        enabled: true,
        locked: false,
        shy: false,
        label: 1,
        selectedProperties: ["Position"],
        selectedKeyframeCount: 2,
        transform: {},
        textValue: "Hello",
      },
    ],
    notes: [],
    ...overrides,
  });
}

test("registry search finds the deterministic command pack by partial query", () => {
  const context = createContext();

  assert.equal(searchMotionRegistry({ prompt: "anchor", context })[0]?.id, "center-anchor-point");
  assert.equal(searchMotionRegistry({ prompt: "null", context })[0]?.id, "parent-to-null");
  assert.equal(searchMotionRegistry({ prompt: "trim", context })[0]?.id, "trim-layer-to-playhead");
  assert.equal(searchMotionRegistry({ prompt: "ease", context })[0]?.id, "easy-ease-selected-keyframes");
  assert.equal(searchMotionRegistry({ prompt: "text", context })[0]?.id, "create-text-layer");
  assert.equal(searchMotionRegistry({ prompt: "pivot", context })[0]?.id, "center-anchor-point");
  assert.equal(searchMotionRegistry({ prompt: "blur", context })[0]?.id, "toggle-motion-blur");
});

test("easy ease availability depends on selected keyframes", () => {
  const noKeyframeContext = createContext({
    selectedLayers: [
      {
        index: 1,
        name: "Title",
        type: "text",
        threeD: false,
        inPoint: 0,
        outPoint: 5,
        startTime: 0,
        parentName: null,
        enabled: true,
        locked: false,
        shy: false,
        label: 1,
        selectedProperties: ["Position"],
        selectedKeyframeCount: 0,
        transform: {},
        textValue: "Hello",
      },
    ],
  });

  const [match] = searchMotionRegistry({ prompt: "easy ease", context: noKeyframeContext });
  assert.equal(match?.id, "easy-ease-selected-keyframes");
  assert.equal(match?.available, false);
});
