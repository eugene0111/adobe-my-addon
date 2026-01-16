/**
 * API service for communicating with the backend
 * Handles all HTTP requests to the BrandGuard backend
 */

import { BACKEND_URL } from "../config.js";

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(endpoint, options = {}) {
  const DEFAULT_BRAND_PROFILE = {
    spacing: {
      padding: 24,
      margin: 16,
      gap: 12,
    },
    colors: {
      primary: "#000000",
      secondary: "#00f0a0",
      background: "#FFFFFF",
      text: "#1F2937",
    },
    fonts: {
  heading: "Inter",
  body: "Inter",

  h1_size: 32,
  h2_size: 24,
  h3_size: 20,
  body_size: 16,
  caption_size: 12,
},
    borders: {
      radius: 18,
      width: 1,
      style: "solid",
    },
  };
  const url = `${BACKEND_URL}${endpoint}`;
  console.log(`[API] Making request to: ${url}`, {
    endpoint,
    body: options.body,
  });

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === "object") {
    const bodyWithBrandProfile = {
      ...options.body,
      brand_profile: options.body.brand_profile || DEFAULT_BRAND_PROFILE,
    };

    config.body = JSON.stringify(bodyWithBrandProfile);

    console.log("[API] Final request body:", bodyWithBrandProfile);
  }

  try {
    const response = await fetch(url, config);

    // Handle non-JSON responses
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new ApiError(
        `Expected JSON but got: ${
          contentType || "unknown"
        }. Response: ${text.substring(0, 200)}`,
        response.status,
        { text }
      );
    }

    if (!response.ok) {
      console.error(`[API] Request failed: ${response.status}`, data);
      throw new ApiError(
        data.message || data.error || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    console.log(`[API] Request successful: ${url}`);
    console.log("[API] Response data:", data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Provide more helpful error messages
    let errorMessage = error.message;
    if (
      error.message === "Failed to fetch" ||
      error.message.includes("fetch")
    ) {
      errorMessage = `Cannot connect to backend at ${BACKEND_URL}. Make sure the server is running.`;
    }

    console.error(`[API] Request error: ${url}`, error);
    throw new ApiError(errorMessage, 0, {
      originalError: error.message,
      url,
      endpoint,
    });
  }
}

const brandProfile = {
  spacing: {
    padding: 24,
    margin: 16,
    gap: 12,
  },
  colors: {
    primary: "#000000",
    secondary: "#00f0a0",
    background: "#FFFFFF",
    text: "#1F2937",
  },
  fonts: {
  heading: "Inter",
  body: "Inter",

  h1_size: 32,
  h2_size: 24,
  h3_size: 20,
  body_size: 16,
  caption_size: 12,
},
    borders: {
      radius: 18,
      width: 1,
      style: "solid",
    },
};

/**
 * Validate design against brand profile
 * @param {Object} brandProfile - Brand profile object
 * @param {Object} documentData - Extracted document data
 * @returns {Promise<Object>} Validation results with violations
 */
export async function validateDesign(documentData) {
  return apiRequest("/brand/validate", {
    method: "POST",
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
  return apiRequest("/fix/plan", {
    method: "POST",
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
  return apiRequest("/fix/execute", {
    method: "POST",
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
  return apiRequest("/tools/apply-gradient", {
    method: "POST",
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
  return apiRequest("/tools/add-texture", {
    method: "POST",
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
export async function generateBrandProfile(
  brandStatement,
  format = "instagram_post"
) {
  return apiRequest("/brand/generate", {
    method: "POST",
    body: {
      brand_statement: brandStatement,
      format,
    },
  });
}

// NEW: Send extracted elements to backend
export async function sendExtractedElements(elements) {
  return apiRequest("/brand/validate", {
    method: "POST",
    body: {
      document_data: {
        elements,
      },
    },
  });
}

export { ApiError };
