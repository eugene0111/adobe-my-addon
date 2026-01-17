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

/**
 * Custom logging function to allow toggling debug messages.
 * In a production environment, you might want to remove debug logs.
 */
const customLogger = {
  debug: (...args) => {
    // console.debug is often hidden by default in browser consoles.
    // Use console.log for broader visibility during development.
    // For production, consider a build step to strip these or a global flag.
    // console.log("[DEBUG]", ...args);
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  log: (...args) => console.log(...args)
};

/**
 * Finds a node by its ID (guid or id) within the entire document structure.
 * This is crucial for applying fixes to elements regardless of current selection or insertion parent.
 *
 * @param {string} elementId - The element ID (guid or id) to search for.
 * @returns {Object|null} The found node or null.
 */
function findNodeById(elementId) {
  // Basic guard for bad input
  if (!elementId) {
    customLogger.debug('[findNodeById] elementId is null or empty.');
    return null;
  }

  const document = editor.document;

  // Hard fail when document is missing
  if (!document) {
    customLogger.error('[findNodeById] CRITICAL: editor.document is not available. Sandbox may have lost context.');
    console.error('[findNodeById] Editor state:', {
      editorExists: !!editor,
      documentExists: !!document,
      editorKeys: editor ? Object.keys(editor).slice(0, 10) : [],
    });
    return null;
  }

  customLogger.debug(`[findNodeById] Starting search for element ID: "${elementId}"`);

  // ---------------- Helper: recursive search ----------------
  function searchNode(node, targetId, path = 'document') {
    // Null/undefined guard
    if (!node) {
      return null;
    }

    const nodeId = node.id || node.guid;
    const nodeType = node.type;

    customLogger.debug(
      `[findNodeById] Checking node: ${nodeType} (${nodeId}) in path: ${path}`
    );

    // Direct match on id/guid
    if (nodeId === targetId) {
      customLogger.debug(
        `[findNodeById] Found node directly: ${nodeType} (${nodeId})`
      );
      return node;
    }

    let childrenToSearch = [];

    // 1) Normal children
    if (node.children) {
      customLogger.debug(
        `[findNodeById] Adding 'children' of ${nodeType} (${nodeId}) to search list.`
      );
      childrenToSearch = childrenToSearch.concat(Array.from(node.children));
    }

    // 2) Extra container sets (allChildren) for container-like nodes
    if (
      nodeType === constants.SceneNodeType.mediaContainer ||
      nodeType === constants.SceneNodeType.group ||
      nodeType === constants.SceneNodeType.artboard
    ) {
      if (node.allChildren) {
        customLogger.debug(
          `[findNodeById] Adding 'allChildren' of ${nodeType} (${nodeId}) to search list.`
        );
        const existingChildIds = new Set(
          Array.from(node.children || []).map((c) => c.id || c.guid)
        );
        const newChildren = Array.from(node.allChildren).filter(
          (c) => !existingChildIds.has(c.id || c.guid)
        );
        childrenToSearch = childrenToSearch.concat(newChildren);
      }
    }

    // 3) Special handling for document root → pages
    if (nodeType === constants.SceneNodeType.root && node.pages) {
      customLogger.debug('[findNodeById] Traversing "pages" for document root.');
      for (const page of node.pages) {
        const found = searchNode(
          page,
          targetId,
          `${path} > page(${page.id || page.guid})`
        );
        if (found) {
          return found;
        }
      }
    }
    // 4) Special handling for PageNode → artboards
    else if (nodeType === constants.SceneNodeType.page && node.artboards) {
      customLogger.debug(
        `[findNodeById] Traversing "artboards" for page ${nodeId}.`
      );
      for (const artboard of node.artboards) {
        const found = searchNode(
          artboard,
          targetId,
          `${path} > artboard(${artboard.id || artboard.guid})`
        );
        if (found) {
          return found;
        }
      }
    }

    // 5) Generic recursion through collected children
    for (const child of childrenToSearch) {
      const childId = child.id || child.guid;
      const found = searchNode(
        child,
        targetId,
        `${path} > ${child.type}(${childId})`
      );
      if (found) {
        return found;
      }
    }

    // Not found below this node
    return null;
  }

  // ---------------- Start search strategy ----------------

  // 1) Try current selection
  const selection = editor.context && editor.context.selection;
  if (selection && selection.length > 0) {
    customLogger.debug('[findNodeById] Checking current selection.');
    for (const selectedNode of selection) {
      const found = searchNode(
        selectedNode,
        elementId,
        `selection(${selectedNode.id || selectedNode.guid})`
      );
      if (found) {
        customLogger.debug('[findNodeById] Found in current selection.');
        return found;
      }
    }
  }

  // 2) Try insertion parent
  const insertionParent = editor.context && editor.context.insertionParent;
  if (insertionParent) {
    customLogger.debug('[findNodeById] Checking insertion parent path.');
    const found = searchNode(
      insertionParent,
      elementId,
      `insertionParent(${insertionParent.id || insertionParent.guid})`
    );
    if (found) {
      customLogger.debug('[findNodeById] Found in insertion parent path.');
      return found;
    }
  }

  // 3) Full document traversal from root
  if (document.root) {
    customLogger.debug(
      '[findNodeById] Performing full document traversal starting from root.'
    );
    const found = searchNode(document.root, elementId, 'document.root');
    if (found) {
      customLogger.debug('[findNodeById] Found via full document traversal.');
      return found;
    }
  } else {
    customLogger.warn('[findNodeById] document.root is not available.');
  }

  // Final failure
  customLogger.warn(
    `[findNodeById] Element with ID "${elementId}" not found in document after all attempts.`
  );
  return null;
}

// Initialize fix executor
const { applyFix, applyBulkFixes } = createFixExecutor(
  editor,
  fonts,
  colorUtils,
  findNodeById
);

// Initialize enhancement tools
const { addTexture, applyGradient, enhanceBackground } = createEnhancementTools(
  editor,
  colorUtils,
  findNodeById
);

/**
 * Convert coordinates to human-readable position description
 * @param {Object} node - The document node
 * @param {number} canvasWidth - Canvas width (optional, defaults to 1920)
 * @param {number} canvasHeight - Canvas height (optional, defaults to 1080)
 * @returns {string} Human-readable position like "top-left", "center", "bottom-right"
 */
function describePosition(node, canvasWidth = 1920, canvasHeight = 1080) {
  if (!node || !Object.prototype.hasOwnProperty.call(node, 'translation')) {
    return "Unknown position";
  }

  const { x, y } = node.translation;

  // Get actual canvas dimensions if available
  const doc = editor.document;
  if (doc?.width) canvasWidth = doc.width;
  if (doc?.height) canvasHeight = doc.height;

  // Determine horizontal position (left, center, right)
  const horizontal =
    x < canvasWidth * 0.33 ? "left" :
    x < canvasWidth * 0.66 ? "center" : "right";

  // Determine vertical position (top, middle, bottom)
  const vertical =
    y < canvasHeight * 0.33 ? "top" :
    y < canvasHeight * 0.66 ? "middle" : "bottom";

  // Combine into readable string
  if (vertical === "middle" && horizontal === "center") {
    return "center";
  }
  return `${vertical}-${horizontal}`;
}

/**
 * Get element type in human-readable format
 * @param {string} nodeType - The node type from SDK
 * @returns {string} Human-readable element type
 */
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

// Expose APIs that UI can call via apiProxy
runtime.exposeApi({
  /**
   * Extract document data for validation
   * @returns {Promise<Object>} Document data in backend format
   */
  async extractDocumentData() {
    try {
      return await extractDocumentData(editor);
    } catch (error) {
      customLogger.error("[Document Sandbox] Error extracting document data:", error);
      return {
        elements: [],
        error: error.message
      };
    }
  },

  /**
   * Execute a single fix action
   * @param {Object} fixAction - The fix action to execute
   * @returns {Promise<Object>} Result with success status
   */
  async executeFix(fixAction) {
    try {
      const doc = editor.document;
      if (!doc) {
        customLogger.error(
          'Document Sandbox: Cannot execute fix – editor.document is not available.'
        );
        return {
          success: false,
          action: fixAction,
          error: 'Document is not available. Please re-open the document and try again.',
        };
      }
      customLogger.log(
        'Document Sandbox',
        'Executing fix action',
        'action',
        fixAction.action,
        'elementId',
        fixAction.element_id || fixAction.elementid,
        'value',
        fixAction.value
      );
      const result = await applyFix(fixAction);
      customLogger.log('Document Sandbox', 'Fix action result', result);
      return result;
    } catch (error) {
      customLogger.error('Document Sandbox: Error executing fix', error);
      return { success: false, action: fixAction, error: error.message };
    }
  },

  /**
   * Execute multiple fix actions
   * @param {Array} fixActions - Array of fix actions
   * @returns {Promise<Array>} Results for each action
   */
  async executeBulkFixes(fixActions) {
    try {
      const doc = editor.document;
      if (!doc) {
        customLogger.error(
          'Document Sandbox: Cannot execute bulk fixes – editor.document is not available.'
        );
        return (Array.isArray(fixActions) ? fixActions : []).map((action) => ({
          success: false,
          action,
          error: 'Document is not available. Please re-open the document and try again.',
        }));
      }
      if (!Array.isArray(fixActions) || fixActions.length === 0) {
        return [];
      }
      return await applyBulkFixes(fixActions);
    } catch (error) {
      customLogger.error('Document Sandbox Error', error);
      return (Array.isArray(fixActions) ? fixActions : []).map((action) => ({
        success: false,
        action,
        error: error.message,
      }));
    }
  },

  /**
   * Add texture to an element
   * @param {string} elementId - Element ID (null for selected element)
   * @param {string} textureType - Texture type (subtle, bold, etc.)
   * @returns {Promise<Object>} Result with success status
   */
  async addBrandTexture(elementId, textureType) {
    try {
      // If elementId is null, try to get selected element
      let targetElementId = elementId;
      if (!targetElementId) {
        const selection = editor.context.selection;
        if (selection && selection.length > 0) {
          targetElementId = selection[0].id || selection[0].guid;
        }
      }

      if (!targetElementId) {
        return {
          success: false,
          error: "No element selected and no elementId provided"
        };
      }

      return await addTexture(targetElementId, MOCK_BRAND_PROFILE, textureType);
    } catch (error) {
      customLogger.error("[Document Sandbox] Error adding texture:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Apply gradient to an element
   * @param {string} elementId - Element ID (null for selected element)
   * @param {string} gradientType - Gradient type (linear, radial, conic)
   * @returns {Promise<Object>} Result with success status
   */
  async applyBrandGradient(elementId, gradientType) {
    try {
      // If elementId is null, try to get selected element
      let targetElementId = elementId;
      if (!targetElementId) {
        const selection = editor.context.selection;
        if (selection && selection.length > 0) {
          targetElementId = selection[0].id || selection[0].guid;
        }
      }

      if (!targetElementId) {
        return {
          success: false,
          error: "No element selected and no elementId provided"
        };
      }

      return await applyGradient(targetElementId, MOCK_BRAND_PROFILE, {
        type: gradientType || 'linear'
      });
    } catch (error) {
      customLogger.error("[Document Sandbox] Error applying gradient:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get element information for display in UI
   * Returns guidance information instead of trying to programmatically select
   * @param {string} elementId - Element ID to get information for
   * @returns {Promise<Object>} Guidance information with human-readable location
   */
  async highlightElement(elementId) {
    try {
      customLogger.log("[Document Sandbox] Getting element information:", elementId);

      const node = findNodeById(elementId);
      if (!node) {
        customLogger.warn("[Document Sandbox] Element not found:", elementId);
        return {
          success: false,
          error: "Element not found",
          message: "The element could not be found on the canvas"
        };
      }

      // Get canvas dimensions
      const doc = editor.document;
      console.log("Editor object keys:", Object.keys(editor));
      console.log("Editor.document:", editor.document);
      console.log("Editor.context:", editor.context);
      console.log("Full editor:", editor);

      const canvasWidth = doc?.width || 1920;
      const canvasHeight = doc?.height || 1080;

      // Get human-readable information
      const humanLocation = describePosition(node, canvasWidth, canvasHeight);
      const elementTypeName = getElementTypeName(node.type);

      // Build guidance message
      const guidanceMessage = `The issue is in the ${elementTypeName} near the ${humanLocation} of your design. Click that element on the canvas, then click 'Fix' to apply the correction.`;

      const elementInfo = {
        success: true,
        elementId: elementId || node.id || node.guid,
        nodeType: node.type,
        elementTypeName: elementTypeName,
        size: {
          width: node.width || 0,
          height: node.height || 0
        },
        position: Object.prototype.hasOwnProperty.call(node, 'translation') ? {
          x: node.translation.x,
          y: node.translation.y
        } : null,
        humanLocation: humanLocation,
        guidanceMessage: guidanceMessage,
        message: guidanceMessage
      };

      customLogger.log("[Document Sandbox] Element information:", elementInfo);

      return elementInfo;
    } catch (error) {
      customLogger.error("[Document Sandbox] Error getting element information:", error);
      return {
        success: false,
        error: error.message,
        message: "Unable to locate the element on the canvas"
      };
    }
  },

  /**
   * Clear highlight from canvas
   * @returns {Promise<Object>} Result with success status
   */
  async clearHighlight() {
    try {
      // Clear selection if possible
      // This is a placeholder - actual implementation depends on SDK
      return { success: true };
    } catch (error) {
      customLogger.error("[Document Sandbox] Error clearing highlight:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Test function - call from console or UI
   * Tests the fix executor with mock data
   */
  async testFixExecutor() {
    try {
      const { MOCK_FIX_ACTIONS } = await import("./utils/mockData.js");
      customLogger.log("[Document Sandbox] Testing fix executor with mock data...");
      return await applyBulkFixes(MOCK_FIX_ACTIONS);
    } catch (error) {
      customLogger.error("[Document Sandbox] Error in test:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Scan document for brand violations
   * Extracts document data and returns it for UI to validate
   * @param {Object} brandProfile - Brand profile to validate against (for reference)
   * @returns {Promise<Object>} Document data ready for validation
   */
  async scanForBrandViolations(brandProfile) {
    try {
      customLogger.log("[Document Sandbox] ========================================");
      customLogger.log("[Document Sandbox] STARTING BRAND VIOLATION SCAN");
      customLogger.log("[Document Sandbox] ========================================");

      // Log editor and document structure
      customLogger.log("[Document Sandbox] Editor structure:", {
        hasEditor: !!editor,
        hasDocument: !!editor?.document,
        hasContext: !!editor?.context,
        hasSelection: !!(editor?.context?.selection),
        selectionCount: editor?.context?.selection?.length || 0,
        hasInsertionParent: !!editor?.context?.insertionParent
      });

      if (editor?.document) {
        const doc = editor.document;
        customLogger.log("[Document Sandbox] Document structure:", {
          hasRoot: !!doc.root,
          rootType: doc.root?.type,
          rootId: doc.root?.id || doc.root?.guid,
          hasPages: !!doc.pages,
          pagesCount: doc.pages?.length || 0,
          documentKeys: Object.keys(doc)
        });

        // Log root node details if available
        if (doc.root) {
          customLogger.log("[Document Sandbox] Root node:", {
            id: doc.root.id || doc.root.guid,
            type: doc.root.type,
            hasChildren: !!(doc.root.children && doc.root.children.length > 0),
            childrenCount: doc.root.children?.length || 0,
            rootKeys: Object.keys(doc.root).slice(0, 15)
          });
        }

        // Log pages if available
        if (doc.pages && Array.isArray(doc.pages)) {
          customLogger.log(`[Document Sandbox] Found ${doc.pages.length} pages`);
          doc.pages.forEach((page, idx) => {
            customLogger.log(`[Document Sandbox] Page ${idx + 1}:`, {
              id: page.id || page.guid,
              type: page.type,
              hasChildren: !!(page.children && page.children.length > 0),
              childrenCount: page.children?.length || 0
            });
          });
        }
      }

      if (!brandProfile) {
        customLogger.warn("[Document Sandbox] No brand profile provided, using mock profile");
        const { MOCK_BRAND_PROFILE } = await import("./utils/mockData.js");
        brandProfile = MOCK_BRAND_PROFILE;
      }

      // Extract document data
      customLogger.log("[Document Sandbox] Calling extractDocumentData...");
      const documentData = await extractDocumentData(editor);

      customLogger.log("[Document Sandbox] ========================================");
      customLogger.log("[Document Sandbox] EXTRACTION RESULTS");
      customLogger.log("[Document Sandbox] ========================================");
      customLogger.log("[Document Sandbox] Elements count:", documentData?.elements?.length || 0);
      customLogger.log("[Document Sandbox] Full document data:", documentData);

      if (!documentData || !documentData.elements || documentData.elements.length === 0) {
        customLogger.warn("[Document Sandbox] No elements found in document");
        // Return empty result but with metadata
        return {
          documentData: { elements: [] },
          brandProfile,
          error: "No elements found in document"
        };
      }

      // Log final result
      customLogger.log("[Document Sandbox] ========================================");
      customLogger.log("[Document Sandbox] SCAN COMPLETE");
      customLogger.log("[Document Sandbox] Ready for validation:", true);
      customLogger.log("[Document Sandbox] ========================================");

      // Return document data for UI to validate (UI has better network access)
      return {
        documentData,
        brandProfile,
        ready: true
      };
    } catch (error) {
      customLogger.error("[Document Sandbox] Error extracting document data:", error);
      customLogger.error("[Document Sandbox] Error stack:", error.stack);
      return {
        documentData: { elements: [] },
        brandProfile: brandProfile || null,
        error: error.message,
        ready: false
      };
    }
  },

  /**
   * Fix violations by planning fixes and executing them
   * @param {Array} violations - Array of violation objects
   * @param {Object} brandProfile - Brand profile to use for fixing
   * @param {Object} options - Options for fix planning (fixAllSimilar, selectedViolations)
   * @returns {Promise<Object>} Results of fix execution
   */
  async fixViolations(violations, brandProfile, options = {}) {
    try {
      if (!violations || violations.length === 0) {
        return { success: true, fixed: 0, failed: 0 };
      }

      if (!brandProfile) {
        customLogger.warn("[Document Sandbox] No brand profile provided, using mock profile");
        const { MOCK_BRAND_PROFILE } = await import("./utils/mockData.js");
        brandProfile = MOCK_BRAND_PROFILE;
      }

      // Call backend to plan fixes
      // NOTE: This assumes `planFixes` and `executeFixes` are correctly imported
      // from "./services/api.js" and are available in the UI context to make network calls.
      // If these also need to run in the sandbox, adjust accordingly.
      const { planFixes, executeFixes } = await import("./services/api.js");
      const planResponse = await planFixes(violations, brandProfile, options);

      customLogger.log("[Document Sandbox] Plan response received:", {
        success: planResponse.success,
        hasFixPlan: !!planResponse.fix_plan,
        hasFixes: !!planResponse.fixes,
        fixPlanActions: planResponse.fix_plan?.actions?.length || 0,
        fixesActions: planResponse.fixes?.actions?.length || 0,
        responseKeys: Object.keys(planResponse)
      });

      // Support both API response formats: fixes.actions and fix_plan.actions
      let actions = null;
      if (planResponse.fixes && planResponse.fixes.actions) {
        // New format: { fixes: { actions: [...] } }
        actions = planResponse.fixes.actions;
        customLogger.log("[Document Sandbox] Using fixes.actions format");
      } else if (planResponse.fix_plan && planResponse.fix_plan.actions) {
        // Old format: { fix_plan: { actions: [...] } }
        actions = planResponse.fix_plan.actions;
        customLogger.log("[Document Sandbox] Using fix_plan.actions format");
      } else if (Array.isArray(planResponse.actions)) {
        // Direct format: { actions: [...] }
        actions = planResponse.actions;
        customLogger.log("[Document Sandbox] Using direct actions format");
      }

      if (!planResponse.success || !actions || actions.length === 0) {
        customLogger.error("[Document Sandbox] Fix planning failed:", planResponse);
        return {
          success: false,
          error: planResponse.message || "Fix planning failed - no actions found",
          fixed: 0,
          failed: violations.length,
          debug: {
            responseKeys: Object.keys(planResponse),
            hasFixes: !!planResponse.fixes,
            hasFixPlan: !!planResponse.fix_plan,
            hasDirectActions: Array.isArray(planResponse.actions)
          }
        };
      }

      customLogger.log("[Document Sandbox] Executing fixes:", actions.length, "actions");

      // Execute fixes in the document
      const executionResults = await applyBulkFixes(actions);

      // Call backend executeFixes for validation/record keeping
      try {
        await executeFixes(actions);
      } catch (backendError) {
        customLogger.warn("[Document Sandbox] Backend executeFixes failed (non-critical):", backendError);
      }

      const successful = executionResults.filter(r => r.success).length;
      const failed = executionResults.filter(r => !r.success).length;

      return {
        success: true,
        fixed: successful,
        failed: failed,
        total: actions.length,
        results: executionResults
      };
    } catch (error) {
      customLogger.error("[Document Sandbox] Error fixing violations:", error);
      return {
        success: false,
        error: error.message,
        fixed: 0,
        failed: violations.length
      };
    }
  }
});