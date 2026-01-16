/**
 * Core fix execution logic
 * Works with mock or real fix actions from the backend
 * 
 * Expected fixAction format (from Person B's fix planner):
 * { 
 *   action: string, 
 *   element_id: string, 
 *   value: any, 
 *   range?: {...}, 
 *   description?: string,
 *   payload?: {...}
 * }
 */

export function createFixExecutor(editor, fonts, colorUtils, findNodeById) {
  
  /**
   * Apply a single fix action to the document
   * @param {Object} fixAction - The fix action to apply
   * @returns {Promise<Object>} Result with success status
   */
  async function applyFix(fixAction) {
    const { action, element_id, value, description } = fixAction;
    
    // Find the node - handle gracefully if not found
    const node = findNodeById(element_id);
    
    if (!node) {
      console.warn(`[FixExecutor] Node ${element_id} not found. It may have been deleted.`);
      return {
        success: false,
        action: fixAction,
        error: `Element ${element_id} not found. It may have been deleted.`,
        skipped: true
      };
    }

    try {
      return await editor.queueAsyncEdit(async () => {
        switch (action) {
          case "update_font_size":
            return await applyFontSize(node, value, fixAction.range);
            
          case "update_font_family":
            return await applyFontFamily(node, value, fixAction.range);
            
          case "update_color":
          case "update_text_color":
            return await applyTextColor(node, value, fixAction.range);
            
          case "update_background_color":
            return await applyBackgroundColor(node, value);
            
          case "update_shape_fill":
            return await applyShapeFill(node, value);
            
          case "update_shape_stroke":
            return await applyShapeStroke(node, value, fixAction.width);
            
          case "update_shadow":
            return await applyShadow(node, fixAction.payload || {});
            
          case "update_border":
            return await applyBorder(node, fixAction.payload || {});
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });
    } catch (error) {
      console.error(`[FixExecutor] Error applying ${action} to ${element_id}:`, error);
      return {
        success: false,
        action: fixAction,
        error: error.message
      };
    }
  }

  // Helper functions for each action type
  async function applyFontSize(node, size, range) {
    if (!node.fullContent || !node.fullContent.applyCharacterStyles) {
      throw new Error('Node does not support font size updates');
    }
    
    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };
    
    node.fullContent.applyCharacterStyles({ fontSize: size }, applyRange);
    return { success: true, applied: { fontSize: size } };
  }

  async function applyFontFamily(node, fontName, range) {
    if (!node.fullContent || !node.fullContent.applyCharacterStyles) {
      throw new Error('Node does not support font family updates');
    }
    
    // Try to get font by PostScript name first, then by family name
    let fontObj = await fonts.fromPostscriptName(fontName);
    if (!fontObj) {
      // Try to find by family name
      const availableFonts = await fonts.list();
      fontObj = availableFonts.find(f => 
        f.family === fontName || f.postscriptName === fontName
      );
    }
    
    if (!fontObj) {
      throw new Error(`Font "${fontName}" is not available`);
    }
    
    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };
    
    node.fullContent.applyCharacterStyles({ font: fontObj }, applyRange);
    return { success: true, applied: { fontFamily: fontName } };
  }

  async function applyTextColor(node, colorHex, range) {
    if (!node.fullContent || !node.fullContent.applyCharacterStyles) {
      throw new Error('Node does not support text color updates');
    }
    
    const color = colorUtils.fromHex(colorHex);
    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };
    
    node.fullContent.applyCharacterStyles({ color }, applyRange);
    return { success: true, applied: { color: colorHex } };
  }

  async function applyBackgroundColor(node, colorHex) {
    const color = colorUtils.fromHex(colorHex);
    node.fill = editor.makeColorFill(color);
    return { success: true, applied: { backgroundColor: colorHex } };
  }

  async function applyShapeFill(node, colorHex) {
    const color = colorUtils.fromHex(colorHex);
    node.fill = editor.makeColorFill(color);
    return { success: true, applied: { fill: colorHex } };
  }

  async function applyShapeStroke(node, colorHex, width = 1) {
    const color = colorUtils.fromHex(colorHex);
    node.stroke = editor.makeStroke({
      color,
      width: width || 1
    });
    return { success: true, applied: { stroke: colorHex, width } };
  }

  async function applyShadow(node, shadowConfig) {
    // Adobe Express SDK shadow support
    if (node.shadow) {
      node.shadow = {
        ...node.shadow,
        ...shadowConfig
      };
    } else if (editor.makeShadow) {
      node.shadow = editor.makeShadow(shadowConfig);
    } else {
      console.warn('[FixExecutor] Shadow not supported on this node type');
    }
    return { success: true, applied: { shadow: shadowConfig } };
  }

  async function applyBorder(node, borderConfig) {
    // Apply border radius if supported
    if (borderConfig.radius !== undefined && node.cornerRadius !== undefined) {
      node.cornerRadius = borderConfig.radius;
    }
    
    // Apply stroke for border
    if (borderConfig.width && borderConfig.color) {
      const color = colorUtils.fromHex(borderConfig.color);
      node.stroke = editor.makeStroke({
        color,
        width: borderConfig.width
      });
    }
    
    return { success: true, applied: { border: borderConfig } };
  }
  
  /**
   * Apply multiple fix actions sequentially
   * @param {Array} fixActions - Array of fix actions
   * @returns {Promise<Array>} Results for each action
   */
  async function applyBulkFixes(fixActions) {
    const results = [];
    
    for (let i = 0; i < fixActions.length; i++) {
      const fixAction = fixActions[i];
      try {
        const result = await applyFix(fixAction);
        results.push(result);
        
        // Small delay between fixes to avoid overwhelming the editor
        if (i < fixActions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        results.push({
          success: false,
          action: fixAction,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  return { applyFix, applyBulkFixes };
}