import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import React, { useState, useCallback } from "react";
import { validateDesign, planFixes } from "../services/api.js";
import { MOCK_BRAND_PROFILE } from "../utils/mockData.js";
import { ToastContainer } from "./Toast";
import "./App.css";

const App = ({ addOnUISdk }) => {
    console.log('[App] Component rendering, addOnUISdk:', addOnUISdk ? 'present' : 'missing');
    
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [selectedViolations, setSelectedViolations] = useState(new Set());
    const [toasts, setToasts] = useState([]);
    const [brandProfile] = useState(MOCK_BRAND_PROFILE); // In production, this would come from user input or storage
    const [hasChecked, setHasChecked] = useState(false); // Track if user has run a check
    const [error, setError] = useState(null);

    // Check if addOnUISdk is available
    if (!addOnUISdk) {
        console.warn('[App] addOnUISdk not provided');
        return (
            <Theme system="express" scale="medium" color="light">
                <div className="container">
                    <div className="error-state">
                        <p>Error: Adobe Express SDK not initialized</p>
                    </div>
                </div>
            </Theme>
        );
    }

    // Toast management
    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Extract document data and validate
    const handleCheckBrandConsistency = useCallback(async () => {
        setLoading(true);
        setError(null);
        setHasChecked(true);
        addToast('Extracting document data...', 'info');

        try {
            // Call document sandbox to extract document data
            const documentData = await addOnUISdk.runtime.apiProxy('extractDocumentData');
            
            if (!documentData || !documentData.elements || documentData.elements.length === 0) {
                addToast('No elements found in document', 'warning');
                setLoading(false);
                return;
            }

            addToast('Validating against brand profile...', 'info');

            // Call backend validation API
            const result = await validateDesign(brandProfile, documentData);

            if (result.success) {
                setViolations(result.violations || []);
                const count = result.violations?.length || 0;
                if (count === 0) {
                    addToast('No violations found! Design is brand-consistent.', 'success');
                } else {
                    addToast(`Found ${count} violation${count !== 1 ? 's' : ''}`, count > 0 ? 'warning' : 'success');
                }
            } else {
                const errorMsg = result.message || 'Unknown error';
                setError(errorMsg);
                addToast('Validation failed: ' + errorMsg, 'error');
            }
        } catch (error) {
            console.error('Error checking brand consistency:', error);
            const errorMsg = error.message || 'Failed to validate design';
            setError(errorMsg);
            addToast(`Error: ${errorMsg}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addOnUISdk, brandProfile, addToast]);

    // Fix a single violation
    const handleFixViolation = useCallback(async (violation) => {
        setFixing(true);
        addToast(`Fixing ${violation.type} violation...`, 'info');

        try {
            // Plan fix for this violation
            const fixPlan = await planFixes([violation], brandProfile, {
                fixAllSimilar: false,
                selectedViolations: [violation]
            });

            if (fixPlan.success && fixPlan.fix_plan && fixPlan.fix_plan.actions.length > 0) {
                // Execute fixes via document sandbox
                const results = await addOnUISdk.runtime.apiProxy('executeBulkFixes', fixPlan.fix_plan.actions);

                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success && !r.skipped).length;
                const skipped = results.filter(r => r.skipped).length;

                if (successful > 0) {
                    addToast(`Fixed ${successful} issue${successful !== 1 ? 's' : ''}`, 'success');
                }
                if (failed > 0) {
                    addToast(`Failed to fix ${failed} issue${failed !== 1 ? 's' : ''}`, 'error');
                }
                if (skipped > 0) {
                    addToast(`Skipped ${skipped} issue${skipped !== 1 ? 's' : ''} (elements not found)`, 'warning');
                }

                // Remove fixed violations from list
                setViolations(prev => prev.filter(v => v.element_id !== violation.element_id || v.type !== violation.type));
            } else {
                addToast('No fix plan generated', 'warning');
            }
        } catch (error) {
            console.error('Error fixing violation:', error);
            addToast(`Error: ${error.message || 'Failed to fix violation'}`, 'error');
        } finally {
            setFixing(false);
        }
    }, [addOnUISdk, brandProfile, addToast]);

    // Fix all violations
    const handleFixAll = useCallback(async () => {
        if (violations.length === 0) {
            addToast('No violations to fix', 'info');
            return;
        }

        setFixing(true);
        addToast(`Fixing all ${violations.length} violations...`, 'info');

        try {
            // Plan fixes for all violations
            const fixPlan = await planFixes(violations, brandProfile, {
                fixAllSimilar: false
            });

            if (fixPlan.success && fixPlan.fix_plan && fixPlan.fix_plan.actions.length > 0) {
                // Execute fixes via document sandbox
                const results = await addOnUISdk.runtime.apiProxy('executeBulkFixes', fixPlan.fix_plan.actions);

                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success && !r.skipped).length;
                const skipped = results.filter(r => r.skipped).length;

                if (successful > 0) {
                    addToast(`Fixed ${successful} issue${successful !== 1 ? 's' : ''}`, 'success');
                }
                if (failed > 0) {
                    addToast(`Failed to fix ${failed} issue${failed !== 1 ? 's' : ''}`, 'error');
                }
                if (skipped > 0) {
                    addToast(`Skipped ${skipped} issue${skipped !== 1 ? 's' : ''} (elements not found)`, 'warning');
                }

                // Clear violations list
                setViolations([]);
            } else {
                addToast('No fix plan generated', 'warning');
            }
        } catch (error) {
            console.error('Error fixing all violations:', error);
            addToast(`Error: ${error.message || 'Failed to fix violations'}`, 'error');
        } finally {
            setFixing(false);
        }
    }, [violations, addOnUISdk, brandProfile, addToast]);

    // Fix all similar violations
    const handleFixAllSimilar = useCallback(async (violation) => {
        setFixing(true);
        addToast(`Fixing all similar ${violation.type} violations...`, 'info');

        try {
            // Plan fixes for all similar violations
            const fixPlan = await planFixes(violations, brandProfile, {
                fixAllSimilar: true,
                selectedViolations: [violation]
            });

            if (fixPlan.success && fixPlan.fix_plan && fixPlan.fix_plan.actions.length > 0) {
                // Execute fixes via document sandbox
                const results = await addOnUISdk.runtime.apiProxy('executeBulkFixes', fixPlan.fix_plan.actions);

                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success && !r.skipped).length;
                const skipped = results.filter(r => r.skipped).length;

                if (successful > 0) {
                    addToast(`Fixed ${successful} similar issue${successful !== 1 ? 's' : ''}`, 'success');
                }
                if (failed > 0) {
                    addToast(`Failed to fix ${failed} issue${failed !== 1 ? 's' : ''}`, 'error');
                }
                if (skipped > 0) {
                    addToast(`Skipped ${skipped} issue${skipped !== 1 ? 's' : ''} (elements not found)`, 'warning');
                }

                // Remove fixed violations from list
                setViolations(prev => prev.filter(v => 
                    !(v.type === violation.type && v.expected === violation.expected)
                ));
            } else {
                addToast('No fix plan generated', 'warning');
            }
        } catch (error) {
            console.error('Error fixing similar violations:', error);
            addToast(`Error: ${error.message || 'Failed to fix violations'}`, 'error');
        } finally {
            setFixing(false);
        }
    }, [violations, addOnUISdk, brandProfile, addToast]);

    // Apply gradient to selection
    const handleApplyGradient = useCallback(async () => {
        try {
            addToast('Applying gradient...', 'info');
            const result = await addOnUISdk.runtime.apiProxy('applyBrandGradient', null, 'linear');
            if (result && result.success) {
                addToast('Gradient applied successfully', 'success');
            } else {
                addToast('Failed to apply gradient', 'error');
            }
        } catch (error) {
            console.error('Error applying gradient:', error);
            addToast(`Error: ${error.message || 'Failed to apply gradient'}`, 'error');
        }
    }, [addOnUISdk, addToast]);

    // Add texture to selection
    const handleAddTexture = useCallback(async () => {
        try {
            addToast('Adding texture...', 'info');
            const result = await addOnUISdk.runtime.apiProxy('addBrandTexture', null, 'subtle');
            if (result && result.success) {
                addToast('Texture added successfully', 'success');
            } else {
                addToast('Failed to add texture', 'error');
            }
        } catch (error) {
            console.error('Error adding texture:', error);
            addToast(`Error: ${error.message || 'Failed to add texture'}`, 'error');
        }
    }, [addOnUISdk, addToast]);

    const getViolationIcon = (type) => {
        switch (type) {
            case 'font_size': return '📏';
            case 'font_family': return '🔤';
            case 'color': return '🎨';
            case 'background_color': return '🖼️';
            default: return '⚠️';
        }
    };

    const getSeverityColor = (severity) => {
        return severity === 'error' ? '#cc0000' : '#ff8800';
    };

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                <div className="header">
                    <h2 className="title">BrandGuard</h2>
                    <p className="subtitle">Brand Consistency Assistant</p>
                </div>

                <div className="actions-section">
                    <Button 
                        size="m" 
                        onClick={handleCheckBrandConsistency}
                        disabled={loading || fixing}
                        className="primary-button"
                    >
                        {loading ? 'Checking...' : 'Check Brand Consistency'}
                    </Button>

                    {violations.length > 0 && (
                        <div className="bulk-actions">
                            <Button 
                                size="m" 
                                onClick={handleFixAll}
                                disabled={fixing}
                                className="fix-all-button"
                            >
                                {fixing ? 'Fixing...' : `Fix All (${violations.length})`}
                            </Button>
                        </div>
                    )}
                </div>

                {violations.length > 0 && (
                    <div className="violations-section">
                        <h3 className="section-title">
                            Violations ({violations.length})
                        </h3>
                        <div className="violations-list">
                            {violations.map((violation, index) => (
                                <div 
                                    key={`${violation.element_id}-${violation.type}-${index}`}
                                    className="violation-item"
                                    style={{ borderLeftColor: getSeverityColor(violation.severity || 'warning') }}
                                >
                                    <div className="violation-header">
                                        <span className="violation-icon">{getViolationIcon(violation.type)}</span>
                                        <div className="violation-info">
                                            <div className="violation-type">{violation.type.replace('_', ' ')}</div>
                                            <div className="violation-message">
                                                {violation.message || 
                                                    `Expected ${violation.expected}, found ${violation.found}`}
                                            </div>
                                            <div className="violation-element">Element: {violation.element_id}</div>
                                        </div>
                                    </div>
                                    <div className="violation-actions">
                                        <Button 
                                            size="s" 
                                            onClick={() => handleFixViolation(violation)}
                                            disabled={fixing}
                                            className="fix-button"
                                        >
                                            Fix
                                        </Button>
                                        <Button 
                                            size="s" 
                                            onClick={() => handleFixAllSimilar(violation)}
                                            disabled={fixing}
                                            className="fix-similar-button"
                                        >
                                            Fix All Similar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {violations.length === 0 && !loading && hasChecked && !error && (
                    <div className="empty-state">
                        <p>No violations found. Your design is brand-consistent! 🎉</p>
                    </div>
                )}

                {!hasChecked && !loading && (
                    <div className="welcome-state">
                        <p>Welcome to BrandGuard! 👋</p>
                        <p className="welcome-subtitle">Click "Check Brand Consistency" to analyze your design against your brand profile.</p>
                    </div>
                )}

                {error && (
                    <div className="error-state">
                        <p>⚠️ Error: {error}</p>
                        <p className="error-subtitle">Please check your backend connection and try again.</p>
                    </div>
                )}

                <div className="tools-section">
                    <h3 className="section-title">Enhancement Tools</h3>
                    <div className="tools-buttons">
                        <Button 
                            size="m" 
                            onClick={handleApplyGradient}
                            disabled={fixing || loading}
                            className="tool-button"
                        >
                            Apply Gradient
                        </Button>
                        <Button 
                            size="m" 
                            onClick={handleAddTexture}
                            disabled={fixing || loading}
                            className="tool-button"
                        >
                            Add Texture
                </Button>
                    </div>
                </div>

                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </div>
        </Theme>
    );
};

export default App;