/**
 * Pure utility functions - no dependencies on SDK or backend
 * These work with ANY color/font data
 */

// Convert hex to RGB
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  // Convert RGB to hex
  export function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }
  
  // Calculate color distance (Euclidean in RGB)
  export function colorDistance(color1, color2) {
    const rgb1 = typeof color1 === 'string' ? hexToRgb(color1) : color1;
    const rgb2 = typeof color2 === 'string' ? hexToRgb(color2) : color2;
    
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
  }
  
  // Find closest brand color
  export function findClosestBrandColor(targetColor, brandColors) {
    let closest = brandColors[0];
    let minDistance = Infinity;
    
    for (const brandColor of brandColors) {
      const distance = colorDistance(targetColor, brandColor);
      if (distance < minDistance) {
        minDistance = distance;
        closest = brandColor;
      }
    }
    
    return closest;
  }
  
  // Check if color matches brand palette (with tolerance)
  export function isColorInBrandPalette(colorHex, brandColors, tolerance = 0.1) {
    const maxDistance = 255 * tolerance;
    
    return brandColors.some(brandColor => {
      const distance = colorDistance(colorHex, brandColor);
      return distance <= maxDistance;
    });
  }
  
  // Validate if font is allowed
  export function isFontAllowed(fontName, allowedFonts) {
    return allowedFonts.includes(fontName);
  }
  
  // Validate if size is allowed
  export function isSizeAllowed(size, allowedSizes) {
    return allowedSizes.includes(size);
  }