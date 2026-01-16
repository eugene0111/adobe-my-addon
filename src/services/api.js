/**
 * API service for communicating with the backend
 * Handles all HTTP requests to the BrandGuard backend
 */

import { BACKEND_URL } from '../config.js';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network error: ${error.message}`,
      0,
      { originalError: error.message }
    );
  }
}

/**
 * Validate design against brand profile
 * @param {Object} brandProfile - Brand profile object
 * @param {Object} documentData - Extracted document data
 * @returns {Promise<Object>} Validation results with violations
 */
export async function validateDesign(brandProfile, documentData) {
  return apiRequest('/brand/validate', {
    method: 'POST',
    body: {
      brand_profile: brandProfile,
      document_data: documentData,
    },
  });
}

/**
 * Plan fixes for violations
 * @param {Array} violations - Array of violation objects
 * @param {Object} brandProfile - Brand profile object
 * @param {Object} options - Options like fixAllSimilar, selectedViolations
 * @returns {Promise<Object>} Fix plan with actions
 */
export async function planFixes(violations, brandProfile, options = {}) {
  return apiRequest('/fix/plan', {
    method: 'POST',
    body: {
      violations,
      brand_profile: brandProfile,
      options,
    },
  });
}

/**
 * Execute fix actions (backend validation only, actual execution is in SDK)
 * @param {Array} actions - Array of fix action objects
 * @returns {Promise<Object>} Execution results
 */
export async function executeFixes(actions) {
  return apiRequest('/fix/execute', {
    method: 'POST',
    body: {
      actions,
    },
  });
}

/**
 * Apply gradient to selection
 * @param {Object} brandProfile - Brand profile object
 * @param {Object} options - Gradient options (type, direction, stops)
 * @returns {Promise<Object>} Gradient data with CSS and SDK payload
 */
export async function applyGradient(brandProfile, options = {}) {
  return apiRequest('/tools/apply-gradient', {
    method: 'POST',
    body: {
      brand_profile: brandProfile,
      options,
    },
  });
}

/**
 * Get textures for brand
 * @param {Object} brandProfile - Brand profile object
 * @param {string} textureId - Optional specific texture ID
 * @returns {Promise<Object>} Texture data with URLs and metadata
 */
export async function addTexture(brandProfile, textureId = null) {
  return apiRequest('/tools/add-texture', {
    method: 'POST',
    body: {
      brand_profile: brandProfile,
      texture_id: textureId,
    },
  });
}

/**
 * Generate brand profile from description
 * @param {string} brandStatement - Brand description
 * @param {string} format - Design format (e.g., 'instagram_post')
 * @returns {Promise<Object>} Generated brand profile
 */
export async function generateBrandProfile(brandStatement, format = 'instagram_post') {
  return apiRequest('/brand/generate', {
    method: 'POST',
    body: {
      brand_statement: brandStatement,
      format,
    },
  });
}

export { ApiError };
