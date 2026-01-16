/**
 * Document extractor utility
 * Extracts document data from Adobe Express SDK for backend validation
 * 
 * HOW TO EXTRACT ELEMENTS FROM ADOBE EXPRESS DOCUMENT:
 * ====================================================
 * 
 * The Adobe Express SDK provides access to document elements through:
 * 
 * 1. PRIMARY METHOD: editor.context.insertionParent
 *    - This is the root node containing all elements on the canvas
 *    - Traverse insertionParent.children recursively to get all elements
 *    - This is the recommended approach per Adobe Express SDK docs
 * 
 * 2. SELECTION: editor.context.selection
 *    - Use if you only want currently selected elements
 *    - Check context.hasSelection first
 * 
 * 3. DOCUMENT STRUCTURE:
 *    - editor.document.root - Root document node (may not always be available)
 *    - editor.document.pages - Array of pages (for multi-page documents)
 * 
 * TRAVERSAL PATTERN:
 * ------------------
 * To get all elements, recursively traverse from insertionParent:
 * 
 *   const root = editor.context.insertionParent;
 *   function traverse(node) {
 *     // Process node (extract data)
 *     if (node.children) {
 *       node.children.forEach(child => traverse(child));
 *     }
 *   }
 *   traverse(root);
 * 
 * NODE PROPERTIES:
 * ----------------
 * - node.id or node.guid - Unique identifier
 * - node.type - Node type (e.g., 'text', 'shape', 'group')
 * - node.children - Array of child nodes
 * - node.fullContent - For text nodes, contains text and textStyle
 * - node.fill - Fill color/style
 * - node.translation, node.width, node.height - Position and size
 */

/**
 * Extract document data from the current Adobe Express document
 * This function should be called from the document sandbox (code.js)
 * 
 * @param {Object} editor - Adobe Express editor instance (imported from express-document-sdk)
 * @returns {Promise<Object>} Document data in backend format: { elements: [...] }
 */
export async function extractDocumentData(editor) {
  const elements = [];
  
  console.log("[DocumentExtractor] === Starting extraction ===");
  console.log("[DocumentExtractor] Editor:", editor);
  console.log("[DocumentExtractor] Editor.document:", editor.document);
  console.log("[DocumentExtractor] Editor.context:", editor.context);
  
  const document = editor.document;
  const context = editor.context;

  // PRIMARY STRATEGY: Use insertionParent (Adobe Express SDK recommended approach)
  // The insertionParent is the root node containing all elements on the canvas
  if (context && context.insertionParent) {
    console.log("[DocumentExtractor] ✅ Using insertionParent (primary method)");
    const root = context.insertionParent;
    console.log("[DocumentExtractor] Root node:", {
      id: root.id || root.guid,
      type: root.type,
      hasChildren: !!(root.children && root.children.length > 0),
      childrenCount: root.children?.length || 0
    });
    
    // Traverse from root
    traverseNode(root, 0, elements);
    
    // Also check if root itself should be included (if it's an element)
    // Usually insertionParent is a container, but check if it's a visible element
    if (root.type && root.type !== 'root' && root.type !== 'container') {
      console.log("[DocumentExtractor] Root is also an element, already included via traverseNode");
    }
  } else {
    console.warn("[DocumentExtractor] ⚠️ No insertionParent found in context");
  }
  
  // FALLBACK STRATEGY 1: Use selected elements if nothing was found
  if (elements.length === 0 && context) {
    if (context.hasSelection && context.selection && Array.isArray(context.selection) && context.selection.length > 0) {
      console.log("[DocumentExtractor] Fallback 1: Using selected elements -", context.selection.length, "elements");
      context.selection.forEach((node, index) => {
        traverseNode(node, index, elements);
      });
    } else {
      console.log("[DocumentExtractor] No selection found (hasSelection:", context.hasSelection, ")");
    }
  }
  
  // FALLBACK STRATEGY 2: Try document root traversal
  if (elements.length === 0 && document && document.root) {
    console.log("[DocumentExtractor] Fallback 2: Trying document.root traversal");
    traverseNode(document.root, 0, elements);
  }
  
  // FALLBACK STRATEGY 3: Try pages traversal (for multi-page documents)
  if (elements.length === 0 && document && document.pages && Array.isArray(document.pages) && document.pages.length > 0) {
    console.log("[DocumentExtractor] Fallback 3: Trying document.pages traversal -", document.pages.length, "pages");
    document.pages.forEach((page, pageIndex) => {
      traverseNode(page, elements.length, elements);
    });
  }
  
  // FALLBACK STRATEGY 4: Explore document object for other node collections
  if (elements.length === 0 && document) {
    console.log("[DocumentExtractor] Fallback 4: Exploring document object");
    console.log("[DocumentExtractor] Document keys:", Object.keys(document));
    
    // Try common properties
    if (document.children && Array.isArray(document.children)) {
      console.log("[DocumentExtractor] Found document.children:", document.children.length);
      document.children.forEach((child, idx) => {
        traverseNode(child, idx, elements);
      });
    }
    
    if (document.allNodes && Array.isArray(document.allNodes)) {
      console.log("[DocumentExtractor] Found document.allNodes:", document.allNodes.length);
      document.allNodes.forEach((node, idx) => {
        traverseNode(node, idx, elements);
      });
    }
  }

  console.log(`[DocumentExtractor] === Extraction complete: Found ${elements.length} elements ===`);
  return { elements };
}

/**
 * Helper to extract element data from a node
 * @param {Object} node - The document node
 * @param {number} index - The index of the element
 * @returns {Object|null} Extracted element data or null
 */
function extractElementData(node, index) {
  if (!node) {
    console.warn(`[DocumentExtractor] extractElementData: node is null/undefined at index ${index}`);
    return null;
  }

  console.log(`[DocumentExtractor] Extracting element ${index}:`, {
    id: node.id || node.guid,
    type: node.type,
    hasFullContent: !!node.fullContent,
    hasFill: !!node.fill,
    hasChildren: !!(node.children && node.children.length > 0)
  });

  const element = {
    id: node.id || node.guid || `element_${index}`,
    type: node.type || 'unknown',
    position: {
      x: node.translation?.x || 0,
      y: node.translation?.y || 0
    },
    size: {
      width: node.width || 0,
      height: node.height || 0
    },
    text: node.fullContent?.text || node.text || null
  };

  // Extract text styles robustly
  const resolvedTextStyle = extractTextStyle(node);
  if (resolvedTextStyle) {
    element.textStyle = resolvedTextStyle;
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

/**
 * Helper to extract fill data
 * @param {Object} fill - The fill object
 * @returns {Object|null} Extracted fill data
 */
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

  if (typeof fill === 'string') {
    return fill;
  }

  // Some SDKs embed color directly on fill
  if (fill.color) {
    return {
      type: 'solid',
      color: colorToHex(fill.color) || '#000000'
    };
  }

  return null;
}

// Helper to convert color to hex (handles hex strings, rgb/rgba strings, and objects with r/g/b or red/green/blue in 0..1 or 0..255)
function colorToHex(color) {
  if (!color) return null;

  // Strings: hex or rgb(a)
  if (typeof color === 'string') {
    const s = color.trim();
    if (s.startsWith('#')) return s;
    const rgbMatch = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
    if (rgbMatch) {
      const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
      const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
      const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
      const rr = r.toString(16).padStart(2, '0');
      const gg = g.toString(16).padStart(2, '0');
      const bb = b.toString(16).padStart(2, '0');
      return `#${rr}${gg}${bb}`;
    }
    // Unknown string, return as-is
    return s;
  }

  // Objects: r/g/b or red/green/blue
  if (typeof color === 'object') {
    // Nested color object
    if (color.color) {
      return colorToHex(color.color);
    }
    let r = color.r ?? color.red;
    let g = color.g ?? color.green;
    let b = color.b ?? color.blue;
    if (r !== undefined && g !== undefined && b !== undefined) {
      // Determine scale (0..1 or 0..255)
      const useUnitScale = r <= 1 && g <= 1 && b <= 1;
      const scale = useUnitScale ? 255 : 1;
      const rr = Math.round(r * scale).toString(16).padStart(2, '0');
      const gg = Math.round(g * scale).toString(16).padStart(2, '0');
      const bb = Math.round(b * scale).toString(16).padStart(2, '0');
      return `#${rr}${gg}${bb}`;
    }
  }

  return null;
}

// Extract text style from various possible locations on a text node
function extractTextStyle(node) {
  const candidates = [
    node?.fullContent?.textStyle,
    node?.fullContent?.style,
    node?.textStyle,
    node?.style,
    node?.content?.textStyle,
    node?.fullContent?.styleRanges?.[0]?.style,
    node?.fullContent?.styleRanges?.[0],
  ];

  const style = {};
  for (const s of candidates) {
    if (!s) continue;
    const fontFamily = s.font?.family ?? s.fontFamily ?? s.font?.postscriptName ?? s.fontName ?? s.family ?? s.name;
    const fontSize = s.fontSize ?? s.size ?? s.textSize;
    const weight = s.fontWeight ?? s.weight;
    const fontStyle = s.fontStyle ?? s.style;
    const align = s.textAlign ?? s.align;
    const colorRaw = s.color ?? s.textColor ?? (s.fill?.color ?? (typeof s.fill === 'string' ? s.fill : undefined));

    if (fontFamily !== undefined) style.fontFamily = fontFamily;
    if (fontSize !== undefined) style.fontSize = fontSize;
    if (weight !== undefined) style.fontWeight = weight;
    if (fontStyle !== undefined) style.fontStyle = fontStyle;
    if (align !== undefined) style.textAlign = align;
    if (colorRaw !== undefined) style.color = colorToHex(colorRaw) || (typeof colorRaw === 'string' ? colorRaw : undefined);
  }

  return Object.keys(style).length ? style : null;
}

// Helper: normalize children collections (supports arrays, iterables, and object maps)
function getChildren(node) {
  const raw = node?.children ?? node?.content?.children ?? [];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    if (typeof raw.length === 'number' && typeof raw.forEach === 'function') {
      return Array.from(raw);
    }
    if (typeof raw === 'object' && raw[Symbol.iterator]) {
      return Array.from(raw);
    }
    // Fallback: convert object map to array
    return Object.values(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Recursively traverse document to extract all elements
 * @param {Object} node - The node to traverse
 * @param {number} index - The current element index
 */
function traverseNode(node, index = 0, elements) {
  if (!node || typeof node !== 'object') {
    console.warn(`[DocumentExtractor] traverseNode: Invalid node at index ${index}`, node);
    return;
  }
  const element = extractElementData(node, index);
  if (element) {
    elements.push(element);
    console.log(`[DocumentExtractor] Added element ${elements.length}:`, element.id, element.type);
  }
  // Recursively traverse children if they exist
  const children = getChildren(node);
  if (children && children.length > 0) {
    for (const child of children) {
      traverseNode(child, elements.length, elements);
    }
  }
}

