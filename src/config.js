/**
 * Configuration file for the frontend
 * Set your backend URL here or via environment variable
 */

// Backend URL - can be overridden by environment variable
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// API endpoints
export const API_ENDPOINTS = {
  VALIDATE: '/brand/validate',
  PLAN_FIXES: '/fix/plan',
  EXECUTE_FIXES: '/fix/execute',
  APPLY_GRADIENT: '/tools/apply-gradient',
  ADD_TEXTURE: '/tools/add-texture',
  GENERATE_BRAND: '/brand/generate'
};
