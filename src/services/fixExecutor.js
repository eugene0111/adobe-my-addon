/**
 * Core fix execution logic
 * Works with mock or real fix actions from the backend
 */

export function createFixExecutor(editor, fonts, colorUtils, findNodeById) {

  /**
   * Resolve font object asynchronously before the edit transaction
   * @param {string} fontName - The font name/family to resolve
   * @returns {Promise<Object>} The resolved font object
   * @throws {Error} If the font is not available
   */
  async function resolveFont(fontName) {
    // Try to get font by PostScript name first
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
    return fontObj;
  }

  /**
   * Apply a single fix action to the document
   * @param {Object} fixAction - The fix action to apply
   * @returns {Promise<Object>} Result with success status
   */
  async function applyFix(fixAction) {
    const { action, element_id, value, description } = fixAction;

    const node = findNodeById(element_id);

    if (!node) {
      console.warn(`[FixExecutor] Node ${element_id} not found for action "${action}".`);
      return {
        success: false,
        action: fixAction,
        error: `Element ${element_id} not found.`,
        skipped: true
      };
    }

    try {
      // Pre-calculate async stuff OUTSIDE queueAsyncEdit
      let preparedValue = value;

      if (action === "update_font_family") {
        try {
          preparedValue = await resolveFont(value);
        } catch (fontError) {
          return {
            success: false,
            action: fixAction,
            error: fontError.message
          };
        }
      }

      // NOW run synchronous mutations inside queueAsyncEdit
      return await editor.queueAsyncEdit(() => {
        switch (action) {
          case "update_font_size":
            return applyFontSize(node, value, fixAction.range);
          case "update_font_family":
            return applyFontFamily(node, preparedValue, fixAction.range);
          case "update_color":
          case "update_text_color":
            return applyTextColor(node, value, fixAction.range);
          case "update_background_color":
            return applyBackgroundColor(node, value);
          case "update_shape_fill":
            return applyShapeFill(node, value);
          case "update_shape_stroke":
            return applyShapeStroke(node, value, fixAction.width);
          case "update_shadow":
            return applyShadow(node, fixAction.payload || {});
          case "update_border":
            return applyBorder(node, fixAction.payload || {});
          case "move_element":
            return applyMoveElement(node, value);
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });

    } catch (error) {
      console.error(`[FixExecutor] Error applying ${action}:`, error);
      return {
        success: false,
        action: fixAction,
        error: error.message
      };
    }
}


  // --- Helper functions (Synchronous Document Mutations) ---

  /**
   * Moves a node to a new position using direct translation update.
   * This is the recommended approach per Adobe Express SDK documentation for moving elements.
   * @param {Object} node - The node to move.
   * @param {Object} value - Position data: {x, y} for absolute, {dx, dy} for relative, or {position: {x, y}}.
   * @returns {Object} Result with success status and new position.
   * @throws {Error} If the node is invalid, doesn't have a 'translation' property, or value format is incorrect.
   */
  function applyMoveElement(node, value) {
    if (!node) {
      throw new Error("Node is null");
    }
  
    if (!Object.prototype.hasOwnProperty.call(node, 'translation')) {
      throw new Error(`Node type ${node.type} cannot be moved`);
    }
  
    const currentX = node.translation.x ?? 0;
    const currentY = node.translation.y ?? 0;
  
    let newX, newY;
  
    if (value && typeof value === 'object') {
      if ('x' in value && 'y' in value) {
        newX = Number(value.x);
        newY = Number(value.y);
      } else if ('dx' in value || 'dy' in value) {
        newX = currentX + Number(value.dx || 0);
        newY = currentY + Number(value.dy || 0);
      } else if (value.position && 'x' in value.position && 'y' in value.position) {
        newX = Number(value.position.x);
        newY = Number(value.position.y);
      } else {
        throw new Error(`Invalid position format: ${JSON.stringify(value)}`);
      }
    } else {
      throw new Error(`Invalid value type: ${typeof value}`);
    }
  
    if (isNaN(newX) || isNaN(newY)) {
      throw new Error(`Invalid position: x=${newX}, y=${newY}`);
    }
  
    // CRITICAL: Direct mutation - this is what makes it work
    node.translation.x = newX;
    node.translation.y = newY;
  
    return {
      success: true,
      oldPosition: { x: currentX, y: currentY },
      newPosition: { x: newX, y: newY },
      elementId: node.id || node.guid
    };
  }


  // The `recreateNodeAtPosition` function is generally NOT recommended for moving elements
  // as it destroys and recreates the node, potentially losing data, specific properties,
  // event listeners, or complex internal states. Direct 'translation' update should always be preferred.
  // This is left commented out to emphasize that it's an anti-pattern for simple moves.
  /*
  function recreateNodeAtPosition(node, newX, newY) {
    console.warn("[FixExecutor] Using recreateNodeAtPosition - this is a fallback and not recommended for typical moves.");
    const parent = node.parent;

    // Snapshot only relevant properties to attempt recreation
    const snapshot = {
      type: node.type,
      width: node.width,
      height: node.height,
      fill: node.fill,
      stroke: node.stroke,
      cornerRadius: node.cornerRadius,
      opacity: node.opacity,
      // Attempt to preserve text content and basic styles
      fullContent: node.fullContent,
      text: node.fullContent?.text || node.text,
      textStyle: node.fullContent?.textStyle // For text nodes
    };

    let newNode;

    // Create new node based on type
    switch (snapshot.type) {
      case "rectangle":
        newNode = editor.createRectangle();
        break;
      case "ellipse":
        newNode = editor.createEllipse();
        break;
      case "text":
        // For text nodes, try to preserve text content
        newNode = editor.createText(snapshot.text || "");
        if (newNode.fullContent && snapshot.textStyle) {
          try {
            newNode.fullContent.textStyle = snapshot.textStyle;
          } catch (e) {
            console.warn("[FixExecutor] Could not copy text styles during recreation:", e.message);
          }
        }
        break;
      default:
        throw new Error(`Move not supported via recreation for node type: ${snapshot.type}. Supported: rectangle, ellipse, text.`);
    }

    // Apply properties to new node
    if (snapshot.width !== undefined) newNode.width = snapshot.width;
    if (snapshot.height !== undefined) newNode.height = snapshot.height;
    
    newNode.translation = { x: newX, y: newY };

    if (snapshot.fill) newNode.fill = snapshot.fill;
    if (snapshot.stroke) newNode.stroke = snapshot.stroke;
    if (snapshot.cornerRadius !== undefined) newNode.cornerRadius = snapshot.cornerRadius;
    if (snapshot.opacity !== undefined) newNode.opacity = snapshot.opacity;

    // Swap nodes: add new, then remove old
    if (parent && parent.children) {
      parent.children.append(newNode);
      parent.children.remove(node);
    } else {
      console.error("[FixExecutor] Failed to recreate node: parent or parent.children not found.");
      throw new Error("Failed to recreate node: parent container not accessible.");
    }

    console.debug("[FixExecutor] MOVE SUCCESS (recreation)", {
      oldNodeId: node.id || node.guid,
      newNodeId: newNode.id || newNode.guid,
      newPosition: { x: newX, y: newY },
      method: "delete_and_recreate",
      parentType: parent?.type
    });

    return {
      success: true,
      method: "delete_and_recreate",
      oldElementId: node.id || node.guid,
      newElementId: newNode.id || newNode.guid,
      newPosition: { x: newX, y: newY },
      parentType: parent?.type
    };
  }
  */

  /**
   * Applies a font size update to a text node.
   * @param {Object} node - The text node.
   * @param {number} size - The new font size.
   * @param {Object} [range] - Optional character range to apply style (e.g., {start: 0, length: 5}).
   * @returns {Object} Success status.
   * @throws {Error} If node does not support font size updates.
   */
  function applyFontSize(node, size, range) {
    if (!node.fullContent || typeof node.fullContent.applyCharacterStyles !== 'function') {
      throw new Error(`Node type ${node.type} does not support font size updates.`);
    }

    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };

    node.fullContent.applyCharacterStyles({ fontSize: size }, applyRange);
    return { success: true, applied: { fontSize: size } };
  }

  /**
   * Applies a font family update to a text node.
   * @param {Object} node - The text node.
   * @param {Object} fontObj - The resolved font object.
   * @param {Object} [range] - Optional character range to apply style.
   * @returns {Object} Success status.
   * @throws {Error} If node does not support font family updates.
   */
  function applyFontFamily(node, fontObj, range) {
    if (!node.fullContent || typeof node.fullContent.applyCharacterStyles !== 'function') {
      throw new Error(`Node type ${node.type} does not support font family updates.`);
    }

    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };

    node.fullContent.applyCharacterStyles({ font: fontObj }, applyRange);
    return { success: true, applied: { fontFamily: fontObj.family } };
  }

  /**
   * Applies a text color update to a text node.
   * @param {Object} node - The text node.
   * @param {string} colorHex - The new color in hex format (e.g., "#RRGGBB" or "#RRGGBBAA").
   * @param {Object} [range] - Optional character range to apply style.
   * @returns {Object} Success status.
   * @throws {Error} If node does not support text color updates.
   */
  function applyTextColor(node, colorHex, range) {
    if (!node.fullContent || typeof node.fullContent.applyCharacterStyles !== 'function') {
      throw new Error(`Node type ${node.type} does not support text color updates.`);
    }

    const color = colorUtils.fromHex(colorHex);
    const textLength = node.fullContent?.text?.length || 0;
    const applyRange = range || { start: 0, length: textLength };

    node.fullContent.applyCharacterStyles({ color }, applyRange);
    return { success: true, applied: { color: colorHex } };
  }

  /**
   * Applies a background color (fill) to a node.
   * @param {Object} node - The target node.
   * @param {string} colorHex - The new color in hex format.
   * @returns {Object} Success status.
   */
  function applyBackgroundColor(node, colorHex) {
    const color = colorUtils.fromHex(colorHex);
    // Ensure makeColorFill is available and the node supports 'fill'
    if (editor.makeColorFill && Object.prototype.hasOwnProperty.call(node, 'fill')) {
      node.fill = editor.makeColorFill(color);
      return { success: true, applied: { backgroundColor: colorHex } };
    } else {
      console.warn(`[FixExecutor] Node type ${node.type} (ID: ${node.id || node.guid}) does not support background color or editor.makeColorFill is unavailable.`);
      return { success: false, error: `Background color not supported for node type ${node.type}.` };
    }
  }

  /**
   * Applies a shape fill color to a node.
   * @param {Object} node - The target node.
   * @param {string} colorHex - The new color in hex format.
   * @returns {Object} Success status.
   */
  function applyShapeFill(node, colorHex) {
    const color = colorUtils.fromHex(colorHex);
    if (editor.makeColorFill && Object.prototype.hasOwnProperty.call(node, 'fill')) {
      node.fill = editor.makeColorFill(color);
      return { success: true, applied: { fill: colorHex } };
    } else {
      console.warn(`[FixExecutor] Node type ${node.type} (ID: ${node.id || node.guid}) does not support shape fill or editor.makeColorFill is unavailable.`);
      return { success: false, error: `Shape fill not supported for node type ${node.type}.` };
    }
  }

  /**
   * Applies a shape stroke (border) to a node.
   * @param {Object} node - The target node.
   * @param {string} colorHex - The new color in hex format.
   * @param {number} [width=1] - The stroke width.
   * @returns {Object} Success status.
   */
  function applyShapeStroke(node, colorHex, width = 1) {
    const color = colorUtils.fromHex(colorHex);
    if (editor.makeStroke && Object.prototype.hasOwnProperty.call(node, 'stroke')) {
      node.stroke = editor.makeStroke({
        color,
        width: width || 1
      });
      return { success: true, applied: { stroke: colorHex, width } };
    } else {
      console.warn(`[FixExecutor] Node type ${node.type} (ID: ${node.id || node.guid}) does not support shape stroke or editor.makeStroke is unavailable.`);
      return { success: false, error: `Shape stroke not supported for node type ${node.type}.` };
    }
  }

  /**
   * Applies shadow properties to a node.
   * @param {Object} node - The target node.
   * @param {Object} shadowConfig - Shadow configuration.
   * @returns {Object} Success status.
   */
  function applyShadow(node, shadowConfig) {
    if (Object.prototype.hasOwnProperty.call(node, 'shadow')) {
      if (node.shadow) {
        node.shadow = { ...node.shadow, ...shadowConfig };
      } else if (editor.makeShadow) {
        node.shadow = editor.makeShadow(shadowConfig);
      }
      return { success: true, applied: { shadow: shadowConfig } };
    } else {
      console.warn(`[FixExecutor] Shadow not supported on node type ${node.type} (ID: ${node.id || node.guid}).`);
      return { success: false, error: `Shadow not supported for node type ${node.type}.` };
    }
  }

  /**
   * Applies border properties (cornerRadius and stroke) to a node.
   * @param {Object} node - The target node.
   * @param {Object} borderConfig - Border configuration.
   * @returns {Object} Success status.
   */
  function applyBorder(node, borderConfig) {
    const applied = {};
    if (borderConfig.radius !== undefined && Object.prototype.hasOwnProperty.call(node, 'cornerRadius')) {
      node.cornerRadius = borderConfig.radius;
      applied.radius = borderConfig.radius;
    }

    if (borderConfig.width && borderConfig.color) {
      if (editor.makeStroke && Object.prototype.hasOwnProperty.call(node, 'stroke')) {
        const color = colorUtils.fromHex(borderConfig.color);
        node.stroke = editor.makeStroke({
          color,
          width: borderConfig.width
        });
        applied.stroke = borderConfig.color;
        applied.width = borderConfig.width;
      } else {
        console.warn(`[FixExecutor] Border stroke not supported on node type ${node.type} (ID: ${node.id || node.guid}) or editor.makeStroke is unavailable.`);
      }
    }

    if (Object.keys(applied).length > 0) {
      return { success: true, applied: { border: applied } };
    } else {
      console.warn(`[FixExecutor] No border properties applied for node type ${node.type} (ID: ${node.id || node.guid}).`);
      return { success: false, error: `Border properties not fully supported or applied for node type ${node.type}.` };
    }
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

        // Small delay between fixes to avoid overwhelming the editor, especially with UI updates
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