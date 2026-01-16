/**
 * Document extractor utility
 * Extracts document data from Adobe Express SDK for backend validation
 */

/**
 * Extract document data from the current Adobe Express document
 * This function should be called from the document sandbox (code.js)
 * @param {Object} editor - Adobe Express editor instance
 * @returns {Promise<Object>} Document data in backend format
 */
export async function extractDocumentData(editor) {
  const document = editor.document;
  if (!document) {
    return { elements: [] };
  }

  const elements = [];
  
  // Helper to extract element data
  function extractElementData(node, index) {
    const element = {
      id: node.id || node.guid || `element_${index}`,
      type: node.type || 'unknown'
    };

    // Extract text styles if it's a text node
    if (node.fullContent && node.fullContent.text) {
      const textContent = node.fullContent.text;
      const textStyle = node.fullContent.textStyle;
      
      element.textStyle = {};
      
      if (textStyle) {
        if (textStyle.font) {
          element.textStyle.fontFamily = textStyle.font.family || textStyle.font.postscriptName || null;
        }
        if (textStyle.fontSize !== undefined) {
          element.textStyle.fontSize = textStyle.fontSize;
        }
        if (textStyle.fontWeight !== undefined) {
          element.textStyle.fontWeight = textStyle.fontWeight;
        }
        if (textStyle.fontStyle) {
          element.textStyle.fontStyle = textStyle.fontStyle;
        }
        if (textStyle.textAlign) {
          element.textStyle.textAlign = textStyle.textAlign;
        }
        if (textStyle.color) {
          // Convert color object to hex if possible
          element.textStyle.color = colorToHex(textStyle.color);
        }
      }
    }

    // Extract fill (color, gradient, etc.)
    if (node.fill) {
      element.fill = extractFillData(node.fill);
    }

    // Extract background color
    if (node.backgroundColor) {
      element.backgroundColor = colorToHex(node.backgroundColor);
    }

    // Extract border radius
    if (node.cornerRadius !== undefined) {
      element.borderRadius = node.cornerRadius;
    }

    // Extract padding if available
    if (node.padding !== undefined) {
      element.padding = node.padding;
    }

    // Extract shadow if available
    if (node.shadow) {
      element.shadow = {
        x: node.shadow.x || 0,
        y: node.shadow.y || 0,
        blur: node.shadow.blur || 0,
        color: colorToHex(node.shadow.color) || '#000000'
      };
    }

    return element;
  }

  // Helper to extract fill data
  function extractFillData(fill) {
    if (!fill) return null;

    if (fill.type === 'solid' || fill.type === 'color') {
      return {
        type: 'solid',
        color: colorToHex(fill.color) || '#000000'
      };
    }

    if (fill.type === 'gradient' || fill.type === 'linear' || fill.type === 'radial') {
      return {
        type: fill.type,
        stops: (fill.stops || []).map(stop => ({
          color: colorToHex(stop.color) || '#000000',
          offset: stop.offset || 0
        }))
      };
    }

    // Fallback: try to get color as string
    if (typeof fill === 'string') {
      return fill;
    }

    return null;
  }

  // Helper to convert color to hex
  function colorToHex(color) {
    if (!color) return null;
    
    if (typeof color === 'string') {
      // Already a hex string
      if (color.startsWith('#')) {
        return color;
      }
      return null;
    }

    if (typeof color === 'object') {
      // RGB object
      if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
        const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
        const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
        const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
      
      // RGBA object
      if (color.red !== undefined && color.green !== undefined && color.blue !== undefined) {
        const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
        const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
        const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    return null;
  }

  // Recursively traverse document to extract all elements
  function traverseNode(node, index = 0) {
    const element = extractElementData(node, index);
    elements.push(element);

    // Traverse children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child, childIndex) => {
        traverseNode(child, elements.length + childIndex);
      });
    }

    // Traverse content children if different from regular children
    if (node.content && node.content.children && node.content.children !== node.children) {
      node.content.children.forEach((child, childIndex) => {
        traverseNode(child, elements.length + childIndex);
      });
    }
  }

  // Prioritize selected elements if available
  const selection = editor.context?.selection;
  if (selection && selection.length > 0) {
    console.log("[Document Extractor] Found selected elements:", selection.length);
    selection.forEach((node, index) => {
      const element = extractElementData(node, index);
      elements.push(element);
      // Also traverse children of selected nodes
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child, childIndex) => {
          traverseNode(child, elements.length + childIndex);
        });
      }
    });
  }

  // If no elements found yet, traverse document
  if (elements.length === 0) {
    // Start traversal from document root
    if (document.root) {
      traverseNode(document.root, 0);
    } else if (document.pages && Array.isArray(document.pages)) {
      // If document has pages, traverse each page
      document.pages.forEach((page, pageIndex) => {
        traverseNode(page, elements.length);
      });
    } else {
      // Fallback: check insertion parent
      const insertionParent = editor.context?.insertionParent;
      if (insertionParent) {
        traverseNode(insertionParent, 0);
      }
    }
  }

  console.log("[Document Extractor] Extracted", elements.length, "elements");
  return { elements };
}
