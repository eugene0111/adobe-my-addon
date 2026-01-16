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
  console.log("[Document Extractor] ========================================");
  console.log("[Document Extractor] STARTING DOCUMENT EXTRACTION");
  console.log("[Document Extractor] ========================================");
  
  const document = editor.document;
  if (!document) {
    console.warn("[Document Extractor] No document found in editor");
    return { elements: [] };
  }

  console.log("[Document Extractor] Document structure:", {
    hasRoot: !!document.root,
    hasPages: !!document.pages,
    pagesCount: document.pages?.length || 0,
    documentKeys: Object.keys(document)
  });

  const elements = [];
  
  // Helper to extract element data
  function extractElementData(node, index) {
    // Log raw node structure for debugging (safe - no circular refs)
    const nodeInfo = {
      id: node.id || node.guid,
      type: node.type,
      nodeKeys: Object.keys(node),
      hasFullContent: !!node.fullContent,
      hasFill: !!node.fill,
      hasBackgroundColor: !!node.backgroundColor,
      hasCornerRadius: node.cornerRadius !== undefined,
      hasPadding: node.padding !== undefined,
      hasShadow: !!node.shadow,
      hasChildren: !!(node.children && node.children.length > 0),
      childrenCount: node.children?.length || 0
    };
    
    // Try to safely log node properties (avoid circular refs)
    try {
      if (node.fullContent) {
        nodeInfo.fullContentKeys = Object.keys(node.fullContent);
        if (node.fullContent.text) {
          nodeInfo.textPreview = String(node.fullContent.text).substring(0, 50);
        }
      }
      if (node.fill) {
        nodeInfo.fillType = node.fill.type || typeof node.fill;
      }
    } catch (e) {
      nodeInfo.extractionError = e.message;
    }
    
    console.log(`[Document Extractor] Extracting element ${index}:`, nodeInfo);
    
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
  function traverseNode(node, index = 0, depth = 0) {
    const indent = "  ".repeat(depth);
    console.log(`${indent}[Document Extractor] Traversing node at depth ${depth}:`, {
      id: node.id || node.guid,
      type: node.type,
      hasChildren: !!(node.children && node.children.length > 0),
      hasContent: !!(node.content),
      childrenCount: node.children?.length || 0,
      nodeKeys: Object.keys(node).slice(0, 10) // First 10 keys to avoid too much output
    });
    
    const element = extractElementData(node, index);
    elements.push(element);

    // Traverse children
    if (node.children && Array.isArray(node.children)) {
      console.log(`${indent}[Document Extractor] Found ${node.children.length} children`);
      node.children.forEach((child, childIndex) => {
        traverseNode(child, elements.length + childIndex, depth + 1);
      });
    }

    // Traverse content children if different from regular children
    if (node.content && node.content.children && node.content.children !== node.children) {
      console.log(`${indent}[Document Extractor] Found ${node.content.children.length} content children`);
      node.content.children.forEach((child, childIndex) => {
        traverseNode(child, elements.length + childIndex, depth + 1);
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
    console.log("[Document Extractor] No selected elements, traversing full document...");
    
    // Start traversal from document root
    if (document.root) {
      console.log("[Document Extractor] Starting from document.root");
      traverseNode(document.root, 0, 0);
    } else if (document.pages && Array.isArray(document.pages)) {
      // If document has pages, traverse each page
      console.log(`[Document Extractor] Starting from document.pages (${document.pages.length} pages)`);
      document.pages.forEach((page, pageIndex) => {
        console.log(`[Document Extractor] Traversing page ${pageIndex + 1}`);
        traverseNode(page, elements.length, 0);
      });
    } else {
      // Fallback: check insertion parent
      console.log("[Document Extractor] No root or pages, checking insertionParent");
      const insertionParent = editor.context?.insertionParent;
      if (insertionParent) {
        console.log("[Document Extractor] Starting from insertionParent");
        traverseNode(insertionParent, 0, 0);
      } else {
        console.warn("[Document Extractor] No root, pages, or insertionParent found");
        // Try to log the document structure to understand what's available
        console.log("[Document Extractor] Available document properties:", Object.keys(document));
        console.log("[Document Extractor] Document object:", document);
      }
    }
  } else {
    console.log(`[Document Extractor] Found ${elements.length} elements from selection, skipping full traversal`);
  }

  console.log("[Document Extractor] ========================================");
  console.log("[Document Extractor] EXTRACTION COMPLETE");
  console.log("[Document Extractor] Total elements extracted:", elements.length);
  console.log("[Document Extractor] ========================================");
  
  // Log each element in detail
  elements.forEach((element, index) => {
    console.log(`[Document Extractor] Element ${index + 1}:`, {
      id: element.id,
      type: element.type,
      textStyle: element.textStyle,
      fill: element.fill,
      backgroundColor: element.backgroundColor,
      borderRadius: element.borderRadius,
      padding: element.padding,
      shadow: element.shadow,
      fullElement: element
    });
  });
  
  // Log summary
  console.log("[Document Extractor] ========================================");
  console.log("[Document Extractor] SUMMARY:");
  console.log("[Document Extractor] - Total elements:", elements.length);
  console.log("[Document Extractor] - Elements with text:", elements.filter(e => e.textStyle).length);
  console.log("[Document Extractor] - Elements with fill:", elements.filter(e => e.fill).length);
  console.log("[Document Extractor] - Elements with background:", elements.filter(e => e.backgroundColor).length);
  console.log("[Document Extractor] - Elements with shadow:", elements.filter(e => e.shadow).length);
  console.log("[Document Extractor] ========================================");
  
  // Log full document structure (formatted JSON)
  console.log("[Document Extractor] ========================================");
  console.log("[Document Extractor] FULL DOCUMENT DATA (JSON):");
  console.log(JSON.stringify({ elements }, null, 2));
  console.log("[Document Extractor] ========================================");
  
  // Also log as a table for easier reading
  if (elements.length > 0) {
    console.table(elements.map((el, idx) => ({
      index: idx + 1,
      id: el.id,
      type: el.type,
      hasText: !!el.textStyle,
      hasFill: !!el.fill,
      hasBackground: !!el.backgroundColor,
      fontSize: el.textStyle?.fontSize || 'N/A',
      fontFamily: el.textStyle?.fontFamily || 'N/A',
      color: el.textStyle?.color || el.fill?.color || 'N/A'
    })));
  }
  
  return { elements };
}
