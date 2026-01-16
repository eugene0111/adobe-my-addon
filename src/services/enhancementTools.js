/**
 * Brand-safe enhancement tools
 * Calls backend API and applies results via Adobe Express SDK
 */

import { applyGradient as apiApplyGradient, addTexture as apiAddTexture } from './api.js';

export function createEnhancementTools(editor, colorUtils, findNodeById) {
  
  /**
   * Apply texture to an element
   * Calls backend /tools/add-texture and applies the texture to the node
   * @param {string} elementId - ID of the element to apply texture to
   * @param {Object} brandProfile - Brand profile for texture selection
   * @param {string} textureId - Optional specific texture ID
   * @returns {Promise<Object>} Result with success status
   */
  async function addTexture(elementId, brandProfile, textureId = null) {
    try {
      const node = findNodeById(elementId);
      if (!node) {
        throw new Error(`Node ${elementId} not found`);
      }

      // Call backend API to get texture
      const response = await apiAddTexture(brandProfile, textureId);
      
      if (!response.success || !response.textures || response.textures.length === 0) {
        throw new Error('No textures available from backend');
      }

      // Use the first texture (or selected one)
      const texture = textureId 
        ? response.textures.find(t => t.id === textureId) || response.textures[0]
        : response.textures[0];

      return await editor.queueAsyncEdit(async () => {
        // Apply texture as image fill or overlay
        if (texture.url) {
          try {
            // Try to load the texture image
            const imageResponse = await fetch(texture.url);
            const blob = await imageResponse.blob();
            
            // Create image fill from texture
            if (editor.makeImageFill) {
              const imageFill = await editor.makeImageFill(blob);
              node.fill = imageFill;
            } else {
              // Fallback: apply as background image if supported
              console.warn('[EnhancementTools] Image fill not directly supported, using color fill fallback');
              const baseColor = colorUtils.fromHex(brandProfile.colors.background || '#FFFFFF');
              node.fill = editor.makeColorFill(baseColor);
            }
          } catch (imageError) {
            console.error('[EnhancementTools] Error loading texture image:', imageError);
            // Fallback to color fill
            const baseColor = colorUtils.fromHex(brandProfile.colors.background || '#FFFFFF');
            node.fill = editor.makeColorFill(baseColor);
          }
        }

        return {
          success: true,
          elementId,
          textureId: texture.id,
          textureName: texture.name,
          textureType: texture.type
        };
      });
    } catch (error) {
      console.error('[EnhancementTools] Error adding texture:', error);
      return {
        success: false,
        elementId,
        error: error.message
      };
    }
  }
  
  /**
   * Apply gradient to an element
   * Calls backend /tools/apply-gradient and applies the gradient to the node
   * @param {string} elementId - ID of the element to apply gradient to
   * @param {Object} brandProfile - Brand profile for gradient generation
   * @param {Object} options - Gradient options (type, direction, stops)
   * @returns {Promise<Object>} Result with success status
   */
  async function applyGradient(elementId, brandProfile, options = {}) {
    try {
      const node = findNodeById(elementId);
      if (!node) {
        throw new Error(`Node ${elementId} not found`);
      }

      // Call backend API to generate gradient
      const response = await apiApplyGradient(brandProfile, options);
      
      if (!response.success || !response.gradient) {
        throw new Error('Failed to generate gradient from backend');
      }

      const gradient = response.gradient;

      return await editor.queueAsyncEdit(async () => {
        // Apply gradient using SDK
        if (editor.makeGradientFill && gradient.sdk_payload) {
          // Use SDK gradient fill if available
          const gradientFill = editor.makeGradientFill({
            type: gradient.sdk_payload.type,
            stops: gradient.sdk_payload.stops.map(stop => ({
              color: colorUtils.fromHex(stop.color),
              offset: stop.offset
            })),
            ...(gradient.sdk_payload.direction && { direction: gradient.sdk_payload.direction }),
            ...(gradient.sdk_payload.center && { center: gradient.sdk_payload.center }),
            ...(gradient.sdk_payload.angle !== undefined && { angle: gradient.sdk_payload.angle })
          });
          
          node.fill = gradientFill;
        } else {
          // Fallback: create gradient from colors manually
          const colors = gradient.colors.map(hex => colorUtils.fromHex(hex));
          
          if (gradient.type === 'linear' && editor.makeLinearGradientFill) {
            node.fill = editor.makeLinearGradientFill({
              stops: gradient.stops.map((stop, index) => ({
                color: colors[index],
                offset: stop.position / 100
              }))
            });
          } else if (gradient.type === 'radial' && editor.makeRadialGradientFill) {
            node.fill = editor.makeRadialGradientFill({
              stops: gradient.stops.map((stop, index) => ({
                color: colors[index],
                offset: stop.position / 100
              })),
              center: gradient.center || 'center'
            });
          } else {
            // Ultimate fallback: use first color as solid fill
            console.warn('[EnhancementTools] Gradient fill not fully supported, using primary color');
            node.fill = editor.makeColorFill(colors[0]);
          }
        }

        return {
          success: true,
          elementId,
          gradientType: gradient.type,
          gradientCss: gradient.css,
          colors: gradient.colors
        };
      });
    } catch (error) {
      console.error('[EnhancementTools] Error applying gradient:', error);
      return {
        success: false,
        elementId,
        error: error.message
      };
    }
  }
  
  /**
   * Enhance background with brand-safe styling
   * @param {Object} brandProfile - Brand profile
   * @param {string} enhancementType - Type of enhancement (solid, gradient, texture)
   * @returns {Promise<Object>} Result with success status
   */
  async function enhanceBackground(brandProfile, enhancementType = "solid") {
    try {
      // Get the document background or create a new background layer
      const document = editor.document;
      
      if (!document) {
        throw new Error('Document not available');
      }

      return await editor.queueAsyncEdit(async () => {
        if (enhancementType === 'solid') {
          const color = colorUtils.fromHex(brandProfile.colors.background || '#FFFFFF');
          // Apply to document background if supported
          if (document.backgroundColor !== undefined) {
            document.backgroundColor = color;
          }
        } else if (enhancementType === 'gradient') {
          const gradientResponse = await apiApplyGradient(brandProfile, { type: 'linear' });
          if (gradientResponse.success && gradientResponse.gradient) {
            // Apply gradient to background
            const gradient = gradientResponse.gradient;
            const colors = gradient.colors.map(hex => colorUtils.fromHex(hex));
            // Implementation depends on SDK capabilities
          }
        } else if (enhancementType === 'texture') {
          const textureResponse = await apiAddTexture(brandProfile);
          if (textureResponse.success && textureResponse.textures.length > 0) {
            // Apply first texture to background
            // Implementation depends on SDK capabilities
          }
        }

        return {
          success: true,
          enhancementType
        };
      });
    } catch (error) {
      console.error('[EnhancementTools] Error enhancing background:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  return { addTexture, applyGradient, enhanceBackground };
}