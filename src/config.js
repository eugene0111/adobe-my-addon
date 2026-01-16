/**
 * Configuration file for the frontend
 * Set your backend URL here or via environment variable
 */

// Backend URL - can be overridden by environment variable
// In browser, process.env is not available, so we use a fallback
// For production, set this directly or use webpack DefinePlugin
const getBackendUrl = () => {
  // Check if we're in a browser environment with process.env (via webpack)
  if (typeof process !== 'undefined' && process.env && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  // Default to localhost for development
  return 'http://localhost:3000';
};

export const BACKEND_URL = getBackendUrl();

// API endpoints
export const API_ENDPOINTS = {
  VALIDATE: '/brand/validate',
  PLAN_FIXES: '/fix/plan',
  EXECUTE_FIXES: '/fix/execute',
  APPLY_GRADIENT: '/tools/apply-gradient',
  ADD_TEXTURE: '/tools/add-texture',
  GENERATE_BRAND: '/brand/generate'
};
