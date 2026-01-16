/**
 * Document Sandbox - runs with express-document-sdk access
 * 
 * This file exposes APIs that the UI panel can call via runtime.apiProxy()
 */

import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, fonts, colorUtils } from "express-document-sdk";
import { createFixExecutor } from "./services/fixExecutor.js";
import { createEnhancementTools } from "./services/enhancementTools.js";
import { MOCK_BRAND_PROFILE } from "./utils/mockData.js";
import { extractDocumentData } from "./utils/documentExtractor.js";

const { runtime } = addOnSandboxSdk.instance;

/**
 * Find a node by element ID
 * Traverses the document tree to find the node with matching ID
 * @param {string} elementId - The element ID to search for
 * @returns {Object|null} The found node or null
 */
function findNodeById(elementId) {
  if (!elementId) {
    return null;
  }

  const document = editor.document;
  if (!document) {
    return null;
  }

  // Helper function to recursively search through nodes
  function searchNode(node, targetId) {
    // Check if current node matches
    if (node.id === targetId || node.guid === targetId) {
      return node;
    }

    // Check children if they exist
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = searchNode(child, targetId);
        if (found) {
          return found;
        }
      }
    }

    // Check if node has a content property with children
    if (node.content && node.content.children) {
      for (const child of node.content.children) {
        const found = searchNode(child, targetId);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  // Start search from document root
  if (document.root) {
    const found = searchNode(document.root, elementId);
    if (found) {
      return found;
    }
  }

  // Also check insertion parent and its children (common case)
  const insertionParent = editor.context.insertionParent;
  if (insertionParent) {
    // Check insertion parent itself
    if (insertionParent.id === elementId || insertionParent.guid === elementId) {
      return insertionParent;
    }

    // Check insertion parent's children
    if (insertionParent.children) {
      for (const child of insertionParent.children) {
        const found = searchNode(child, elementId);
        if (found) {
          return found;
        }
      }
    }
  }

  // Check selected elements (user might have selected the element)
  const selection = editor.context.selection;
  if (selection && selection.length > 0) {
    for (const selectedNode of selection) {
      if (selectedNode.id === elementId || selectedNode.guid === elementId) {
        return selectedNode;
      }
      // Also search in selected node's children
      const found = searchNode(selectedNode, elementId);
      if (found) {
        return found;
      }
    }
  }

  // Last resort: traverse all pages if document has pages
  if (document.pages && Array.isArray(document.pages)) {
    for (const page of document.pages) {
      const found = searchNode(page, elementId);
      if (found) {
        return found;
      }
    }
  }

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
      console.error("[Document Sandbox] Error extracting document data:", error);
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
      return await applyFix(fixAction);
    } catch (error) {
      console.error("[Document Sandbox] Error executing fix:", error);
      return {
        success: false,
        action: fixAction,
        error: error.message
      };
    }
  },

  /**
   * Execute multiple fix actions
   * @param {Array} fixActions - Array of fix actions
   * @returns {Promise<Array>} Results for each action
   */
  async executeBulkFixes(fixActions) {
    try {
      if (!Array.isArray(fixActions) || fixActions.length === 0) {
        return [];
      }
      return await applyBulkFixes(fixActions);
    } catch (error) {
      console.error("[Document Sandbox] Error executing bulk fixes:", error);
      return fixActions.map(action => ({
        success: false,
        action,
        error: error.message
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
      console.error("[Document Sandbox] Error adding texture:", error);
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
      console.error("[Document Sandbox] Error applying gradient:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Highlight element on canvas (for violation hover)
   * @param {string} elementId - Element ID to highlight
   * @returns {Promise<Object>} Result with success status
   */
  async highlightElement(elementId) {
    try {
      const node = findNodeById(elementId);
      if (!node) {
        return { success: false, error: "Element not found" };
      }

      // Try to select the element (if SDK supports selection)
      if (editor.context && editor.context.selection) {
        // Note: Actual selection API may vary by SDK version
        // This is a placeholder for the highlighting functionality
        return { success: true, elementId };
      }

      return { success: false, error: "Selection not available" };
    } catch (error) {
      console.error("[Document Sandbox] Error highlighting element:", error);
      return {
        success: false,
        error: error.message
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
      console.error("[Document Sandbox] Error clearing highlight:", error);
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
      console.log("[Document Sandbox] Testing fix executor with mock data...");
      return await applyBulkFixes(MOCK_FIX_ACTIONS);
    } catch (error) {
      console.error("[Document Sandbox] Error in test:", error);
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
      console.log("[Document Sandbox] ========================================");
      console.log("[Document Sandbox] STARTING BRAND VIOLATION SCAN");
      console.log("[Document Sandbox] ========================================");
      
      // Log editor and document structure
      console.log("[Document Sandbox] Editor structure:", {
        hasEditor: !!editor,
        hasDocument: !!editor?.document,
        hasContext: !!editor?.context,
        hasSelection: !!(editor?.context?.selection),
        selectionCount: editor?.context?.selection?.length || 0,
        hasInsertionParent: !!editor?.context?.insertionParent
      });
      
      if (editor?.document) {
        const doc = editor.document;
        console.log("[Document Sandbox] Document structure:", {
          hasRoot: !!doc.root,
          rootType: doc.root?.type,
          rootId: doc.root?.id || doc.root?.guid,
          hasPages: !!doc.pages,
          pagesCount: doc.pages?.length || 0,
          documentKeys: Object.keys(doc)
        });
        
        // Log root node details if available
        if (doc.root) {
          console.log("[Document Sandbox] Root node:", {
            id: doc.root.id || doc.root.guid,
            type: doc.root.type,
            hasChildren: !!(doc.root.children && doc.root.children.length > 0),
            childrenCount: doc.root.children?.length || 0,
            rootKeys: Object.keys(doc.root).slice(0, 15)
          });
        }
        
        // Log pages if available
        if (doc.pages && Array.isArray(doc.pages)) {
          console.log(`[Document Sandbox] Found ${doc.pages.length} pages`);
          doc.pages.forEach((page, idx) => {
            console.log(`[Document Sandbox] Page ${idx + 1}:`, {
              id: page.id || page.guid,
              type: page.type,
              hasChildren: !!(page.children && page.children.length > 0),
              childrenCount: page.children?.length || 0
            });
          });
        }
      }
      
      if (!brandProfile) {
        console.warn("[Document Sandbox] No brand profile provided, using mock profile");
        const { MOCK_BRAND_PROFILE } = await import("./utils/mockData.js");
        brandProfile = MOCK_BRAND_PROFILE;
      }

      // Extract document data
      console.log("[Document Sandbox] Calling extractDocumentData...");
      const documentData = await extractDocumentData(editor);
      
      console.log("[Document Sandbox] ========================================");
      console.log("[Document Sandbox] EXTRACTION RESULTS");
      console.log("[Document Sandbox] ========================================");
      console.log("[Document Sandbox] Elements count:", documentData?.elements?.length || 0);
      console.log("[Document Sandbox] Full document data:", documentData);
      
      if (!documentData || !documentData.elements || documentData.elements.length === 0) {
        console.warn("[Document Sandbox] No elements found in document");
        // Return empty result but with metadata
        return {
          documentData: { elements: [] },
          brandProfile,
          error: "No elements found in document"
        };
      }

      // Log final result
      console.log("[Document Sandbox] ========================================");
      console.log("[Document Sandbox] SCAN COMPLETE");
      console.log("[Document Sandbox] Ready for validation:", true);
      console.log("[Document Sandbox] ========================================");
      
      // Return document data for UI to validate (UI has better network access)
      return {
        documentData,
        brandProfile,
        ready: true
      };
    } catch (error) {
      console.error("[Document Sandbox] Error extracting document data:", error);
      console.error("[Document Sandbox] Error stack:", error.stack);
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
        console.warn("[Document Sandbox] No brand profile provided, using mock profile");
        const { MOCK_BRAND_PROFILE } = await import("./utils/mockData.js");
        brandProfile = MOCK_BRAND_PROFILE;
      }

      // Call backend to plan fixes
      const { planFixes, executeFixes } = await import("./services/api.js");
      const planResponse = await planFixes(violations, brandProfile, options);

      if (!planResponse.success || !planResponse.fix_plan || !planResponse.fix_plan.actions) {
        console.error("[Document Sandbox] Fix planning failed:", planResponse);
        return {
          success: false,
          error: planResponse.message || "Fix planning failed",
          fixed: 0,
          failed: violations.length
        };
      }

      const actions = planResponse.fix_plan.actions;
      console.log("[Document Sandbox] Executing fixes:", actions.length, "actions");

      // Execute fixes in the document
      const executionResults = await applyBulkFixes(actions);

      // Call backend executeFixes for validation/record keeping
      try {
        await executeFixes(actions);
      } catch (backendError) {
        console.warn("[Document Sandbox] Backend executeFixes failed (non-critical):", backendError);
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
      console.error("[Document Sandbox] Error fixing violations:", error);
      return {
        success: false,
        error: error.message,
        fixed: 0,
        failed: violations.length
      };
    }
  }
});