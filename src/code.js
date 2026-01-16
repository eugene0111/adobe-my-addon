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

const { runtime } = addOnSandboxSdk.instance;

// Helper to find node by ID (you'll need to implement based on how Person B provides IDs)
function findNodeById(elementId) {
  // TODO: Implement node lookup
  // This depends on how element_id is structured
  // For now, return selected element or traverse document
  return editor.context.insertionParent?.children?.find(
    child => child.id === elementId
  );
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
  async executeFix(fixAction) {
    return await applyFix(fixAction);
  },

  async executeBulkFixes(fixActions) {
    return await applyBulkFixes(fixActions);
  },

  async addBrandTexture(elementId, textureType) {
    return await addTexture(elementId, MOCK_BRAND_PROFILE, textureType);
  },

  async applyBrandGradient(elementId, gradientType) {
    return await applyGradient(elementId, MOCK_BRAND_PROFILE, gradientType);
  },

  // Test function - call from console or UI
  async testFixExecutor() {
    const { MOCK_FIX_ACTIONS } = await import("./utils/mockData.js");
    console.log("[Document Sandbox] Testing fix executor with mock data...");
    return await applyBulkFixes(MOCK_FIX_ACTIONS);
  }
});