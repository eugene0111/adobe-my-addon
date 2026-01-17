/**
 * Document Sandbox - runs with express-document-sdk access
 *
 * This file exposes APIs that the UI panel can call via runtime.apiProxy()
 */

import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, fonts, colorUtils, constants } from "express-document-sdk";
import { createFixExecutor } from "./services/fixExecutor.js";
import { createEnhancementTools } from "./services/enhancementTools.js";
import { MOCK_BRAND_PROFILE } from "./utils/mockData.js";
import { extractDocumentData } from "./utils/documentExtractor.js";

const { runtime } = addOnSandboxSdk.instance;

// --- REAL-TIME WATCHER STATE ---
let isWatching = false;
let lastContentHash = "";

/**
 * Custom logging function to allow toggling debug messages.
 */
const customLogger = {
  debug: (...args) => {
    // console.debug is often hidden by default. Uncomment for verbose logs.
    // console.log("[DEBUG]", ...args);
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  log: (...args) => console.log(...args)
};

// --- HELPER: Change Detection ---

/**
 * Generates a simple hash of the current document state to detect changes.
 * This helps avoid re-sending data if nothing meaningful changed.
 */
function getDocumentHash() {
  try {
    if (!editor.document.root) return "empty";
    
    // 1. Structural Check: Number of elements in root
    // Note: accessing allChildren can be expensive on huge docs, 
    // using children.length is a faster proxy for top-level changes.
    const rootCount = editor.document.root.children.length;
    
    // 2. Selection Check: IDs of selected items
    const selectionIds = editor.context.selection.map(n => n.id).join(',');
    
    // 3. (Optional) Deep check could go here, but we want speed.
    // Combined hash
    return `${rootCount}-${selectionIds}`;
  } catch (e) {
    return "error-" + Date.now();
  }
}

/**
 * Broadcasts the current document data to the UI.
 * This is the "Push" mechanism.
 */
async function broadcastUpdate() {
  try {
    const currentHash = getDocumentHash();
    
    // De-bounce: Don't emit if the structural/selection state hasn't changed
    // AND we have a previous hash (to allow first run to always pass)
    if (lastContentHash && currentHash === lastContentHash) return;
    
    lastContentHash = currentHash;

    // Extract Data
    // customLogger.log("[Sandbox] Detecting changes, extracting data...");
    const data = await extractDocumentData(editor);
    
    // PUSH to UI using runtime.emit (or custom event trigger)
    // The UI must listen for "DOCUMENT_UPDATED"
    if (runtime.emit) {
        runtime.emit("DOCUMENT_UPDATED", data);
    } else {
        // Fallback for older SDKs: UI might need to poll, but we'll log it.
        // customLogger.warn("[Sandbox] runtime.emit not available");
    }
  } catch (err) {
    customLogger.error("[Sandbox] Broadcast failed:", err);
  }
}

/**
 * The Main Watcher Loop.
 * Starts listening for events and polling for changes.
 */
function startDocumentWatcher() {
  if (isWatching) return;
  isWatching = true;

  customLogger.log("[Sandbox] Starting Real-Time Document Watcher...");

  // 1. Initial Broadcast
  broadcastUpdate();

  // 2. Event Listener: Selection Change (Fastest response)
  if (editor.context.on) {
    editor.context.on("selectionchange", () => {
      broadcastUpdate();
    });
  }

  // 3. Polling Heartbeat (1 second)
  // Catches changes that might not trigger selection events (like external updates or undo/redo)
  setInterval(() => {
    const currentHash = getDocumentHash();
    if (currentHash !== lastContentHash) {
      broadcastUpdate();
    }
  }, 1000);
}


// --- NODE FINDER & TOOLS (Existing Logic) ---

/**
 * Finds a node by its ID (guid or id) within the entire document structure.
 */
function findNodeById(elementId) {
  if (!elementId) {
    customLogger.debug('[findNodeById] elementId is null or empty.');
    return null;
  }

  const document = editor.document;
  if (!document) {
    customLogger.error('[findNodeById] CRITICAL: editor.document is not available.');
    return null;
  }

  function searchNode(node, targetId, path = 'document') {
    if (!node) return null;

    const nodeId = node.id || node.guid;
    if (nodeId === targetId) return node;

    let childrenToSearch = [];

    // Normal children
    if (node.children) {
      childrenToSearch = childrenToSearch.concat(Array.from(node.children));
    }

    // Container special children
    if (
      (node.type === constants.SceneNodeType.mediaContainer ||
       node.type === constants.SceneNodeType.group ||
       node.type === constants.SceneNodeType.artboard) && 
      node.allChildren
    ) {
        // Add allChildren that aren't already in children
        // Simplified for perf: just add allChildren
        childrenToSearch = Array.from(node.allChildren);
    }

    // Pages & Artboards traversal
    if (node.type === constants.SceneNodeType.root && node.pages) {
      for (const page of node.pages) {
        const found = searchNode(page, targetId);
        if (found) return found;
      }
    }
    else if (node.type === constants.SceneNodeType.page && node.artboards) {
      for (const artboard of node.artboards) {
        const found = searchNode(artboard, targetId);
        if (found) return found;
      }
    }

    // Recursion
    for (const child of childrenToSearch) {
      const found = searchNode(child, targetId);
      if (found) return found;
    }

    return null;
  }

  // Search strategy
  // 1. Selection
  const selection = editor.context?.selection;
  if (selection) {
    for (const sNode of selection) {
      const found = searchNode(sNode, elementId);
      if (found) return found;
    }
  }
  
  // 2. Root
  if (document.root) {
    return searchNode(document.root, elementId);
  }

  return null;
}

// Initialize tools
const { applyFix, applyBulkFixes } = createFixExecutor(editor, fonts, colorUtils, findNodeById);
const { addTexture, applyGradient } = createEnhancementTools(editor, colorUtils, findNodeById);

/**
 * Helper: Describe Position
 */
function describePosition(node, canvasWidth = 1920, canvasHeight = 1080) {
  if (!node || !node.translation) return "Unknown position";
  const { x, y } = node.translation;
  
  const doc = editor.document;
  if (doc?.width) canvasWidth = doc.width;
  if (doc?.height) canvasHeight = doc.height;

  const horizontal = x < canvasWidth * 0.33 ? "left" : x < canvasWidth * 0.66 ? "center" : "right";
  const vertical = y < canvasHeight * 0.33 ? "top" : y < canvasHeight * 0.66 ? "middle" : "bottom";

  if (vertical === "middle" && horizontal === "center") return "center";
  return `${vertical}-${horizontal}`;
}

function getElementTypeName(nodeType) {
  const typeMap = {
    [constants.SceneNodeType.text]: 'text box',
    [constants.SceneNodeType.rectangle]: 'rectangle',
    [constants.SceneNodeType.ellipse]: 'circle',
    [constants.SceneNodeType.image]: 'image',
    [constants.SceneNodeType.group]: 'group',
    [constants.SceneNodeType.shape]: 'shape',
    [constants.SceneNodeType.artboard]: 'artboard',
    [constants.SceneNodeType.page]: 'page',
    [constants.SceneNodeType.mediaContainer]: 'media container',
    [constants.SceneNodeType.line]: 'line'
  };
  return typeMap[nodeType] || nodeType || 'element';
}

// --- EXPOSED API ---

runtime.exposeApi({
  /**
   * NEW: Starts the real-time watcher.
   * UI calls this once on mount.
   */
  async startRealtimeScan() {
    startDocumentWatcher();
    return true;
  },

  /**
   * Extract document data (Legacy/Manual call)
   */
  async extractDocumentData() {
    try {
      return await extractDocumentData(editor);
    } catch (error) {
      customLogger.error("[Document Sandbox] Error extracting document data:", error);
      return { elements: [], error: error.message };
    }
  },

  /**
   * Execute a single fix action
   */
  async executeFix(fixAction) {
    try {
      const result = await applyFix(fixAction);
      // Force an immediate broadcast update so UI reflects changes
      lastContentHash = ""; // Reset hash to force emit
      broadcastUpdate();
      return result;
    } catch (error) {
      customLogger.error('Document Sandbox: Error executing fix', error);
      return { success: false, action: fixAction, error: error.message };
    }
  },

  /**
   * Execute multiple fix actions
   */
  async executeBulkFixes(fixActions) {
    try {
      if (!Array.isArray(fixActions) || fixActions.length === 0) return [];
      const result = await applyBulkFixes(fixActions);
      // Force an immediate broadcast update
      lastContentHash = ""; // Reset hash to force emit
      broadcastUpdate();
      return result;
    } catch (error) {
      customLogger.error('Document Sandbox Error', error);
      return (Array.isArray(fixActions) ? fixActions : []).map(a => ({ success: false, error: error.message }));
    }
  },

  /**
   * Add texture
   */
  async addBrandTexture(elementId, textureType) {
    // ... logic for texture ...
    // Simplified for brevity, retaining essential call
    let targetId = elementId || (editor.context.selection[0]?.id);
    if (!targetId) return { success: false, error: "No selection" };
    return await addTexture(targetId, MOCK_BRAND_PROFILE, textureType);
  },

  /**
   * Apply gradient
   */
  async applyBrandGradient(elementId, gradientType) {
    let targetId = elementId || (editor.context.selection[0]?.id);
    if (!targetId) return { success: false, error: "No selection" };
    return await applyGradient(targetId, MOCK_BRAND_PROFILE, { type: gradientType || 'linear' });
  },

  /**
   * Get element info for UI highlight/guidance
   */
  async highlightElement(elementId) {
    try {
      const node = findNodeById(elementId);
      if (!node) return { success: false, error: "Element not found" };

      const canvasWidth = editor.document?.width || 1920;
      const canvasHeight = editor.document?.height || 1080;
      const humanLocation = describePosition(node, canvasWidth, canvasHeight);
      const elementTypeName = getElementTypeName(node.type);

      return {
        success: true,
        elementId: node.id || node.guid,
        humanLocation,
        elementTypeName,
        message: `Issue in ${elementTypeName} near ${humanLocation}.`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear highlight
   */
  async clearHighlight() {
    return { success: true };
  },

  /**
   * Scan document for violations (Legacy/Manual)
   */
  async scanForBrandViolations(brandProfile) {
    // Reuses extractDocumentData but wraps it
    const data = await extractDocumentData(editor);
    return {
        documentData: data,
        brandProfile: brandProfile || MOCK_BRAND_PROFILE,
        ready: true
    };
  },

  /**
   * Fix violations
   */
  async fixViolations(violations, brandProfile, options = {}) {
     // NOTE: complex fix logic requiring imports from 'api.js' inside sandbox 
     // is problematic if api.js relies on fetch. 
     // This function assumes the logic can run here.
     try {
        if (!violations?.length) return { success: true, fixed: 0 };
        
        // Dynamic import as per original file
        const { planFixes, executeFixes } = await import("./services/api.js");
        const planResponse = await planFixes(violations, brandProfile || MOCK_BRAND_PROFILE, options);
        
        const actions = planResponse.fixes?.actions || planResponse.fix_plan?.actions || planResponse.actions;
        
        if (!actions?.length) return { success: false, error: "No actions planned" };
        
        const executionResults = await applyBulkFixes(actions);
        
        // Force update UI
        broadcastUpdate();
        
        try { await executeFixes(actions); } catch (e) {}
        
        return {
            success: true,
            fixed: executionResults.filter(r => r.success).length,
            results: executionResults
        };
     } catch (e) {
         return { success: false, error: e.message };
     }
  }
});
