import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import React, { useState, useCallback, useEffect } from "react";
import { validateDesign, planFixes, generateBrandProfile } from "../services/api.js";
import { MOCK_BRAND_PROFILE } from "../utils/mockData.js";
import { ToastContainer } from "./Toast";
import { SkeletonLoader, ViolationSkeleton } from "./SkeletonLoader";
import "./App.css";

const App = ({ addOnUISdk }) => {
    console.log('[App] Component rendering, addOnUISdk:', addOnUISdk ? 'present' : 'missing');
    
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [selectedViolations, setSelectedViolations] = useState(new Set());
    const [toasts, setToasts] = useState([]);
    
    // Brand Profile Management
    const [brandProfile, setBrandProfile] = useState(() => {
        // Load from localStorage on mount
        const saved = localStorage.getItem('brand_profile');
        return saved ? JSON.parse(saved) : MOCK_BRAND_PROFILE;
    });
    const [showBrandProfileForm, setShowBrandProfileForm] = useState(false);
    const [brandStatement, setBrandStatement] = useState('');
    const [format, setFormat] = useState('instagram_post');
    const [generatingProfile, setGeneratingProfile] = useState(false);
    
    const [hasChecked, setHasChecked] = useState(false); // Track if user has run a check
    const [error, setError] = useState(null);
    
    // Polish features
    const [watchMode, setWatchMode] = useState(false); // Real-time watch mode
    const [hoveredViolation, setHoveredViolation] = useState(null); // For canvas highlighting
    const [fixHistory, setFixHistory] = useState([]); // For undo functionality
    const [previewMode, setPreviewMode] = useState(false); // Fix preview mode
    const [showBrandProfileEditor, setShowBrandProfileEditor] = useState(false); // Brand profile editor

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
    const addToast = useCallback((message, type = 'info', duration = 3000, onUndo = null) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration, onUndo }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Brand Profile Generation
    const handleGenerateBrandProfile = useCallback(async () => {
        if (!brandStatement.trim()) {
            addToast('Please enter a brand description', 'warning');
            return;
        }

        setGeneratingProfile(true);
        addToast('Generating brand profile...', 'info');

        try {
            const result = await generateBrandProfile(brandStatement.trim(), format);
            
            if (result.success && result.brand_profile) {
                setBrandProfile(result.brand_profile);
                // Save to localStorage
                localStorage.setItem('brand_profile', JSON.stringify(result.brand_profile));
                localStorage.setItem('brand_statement', brandStatement.trim());
                localStorage.setItem('brand_format', format);
                
                setShowBrandProfileForm(false);
                setBrandStatement('');
                addToast('Brand profile generated successfully!', 'success');
            } else {
                addToast('Failed to generate brand profile', 'error');
            }
        } catch (error) {
            console.error('Error generating brand profile:', error);
            addToast(`Error: ${error.message || 'Failed to generate brand profile'}`, 'error');
        } finally {
            setGeneratingProfile(false);
        }
    }, [brandStatement, format, addToast]);

    // Load saved brand statement on mount
    useEffect(() => {
        const savedStatement = localStorage.getItem('brand_statement');
        const savedFormat = localStorage.getItem('brand_format');
        if (savedStatement) {
            setBrandStatement(savedStatement);
        }
        if (savedFormat) {
            setFormat(savedFormat);
        }
    }, []);

    // Real-time watch mode - auto-scan after document changes
    useEffect(() => {
        if (!watchMode || !addOnUISdk) return;

        let debounceTimer;
        const checkInterval = setInterval(() => {
            // Debounce: only check if no changes for 2 seconds
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (hasChecked && !loading && !fixing) {
                    handleCheckBrandConsistency();
                }
            }, 2000);
        }, 3000); // Check every 3 seconds

        return () => {
            clearInterval(checkInterval);
            clearTimeout(debounceTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchMode, hasChecked, loading, fixing]);

    // Canvas element highlighting on violation hover
    const handleViolationHover = useCallback(async (violation, isHovering) => {
        if (!addOnUISdk || !violation) return;
        
        setHoveredViolation(isHovering ? violation : null);
        
        if (isHovering) {
            try {
                // Try to highlight element on canvas via SDK
                await addOnUISdk.runtime.apiProxy('highlightElement', violation.element_id);
            } catch (error) {
                // Silently fail - highlighting is optional
                console.log('[App] Element highlighting not available:', error);
            }
        } else {
            try {
                await addOnUISdk.runtime.apiProxy('clearHighlight');
            } catch (error) {
                // Silently fail
            }
        }
    }, [addOnUISdk]);

    // Undo last fix operation
    const handleUndoFix = useCallback(async () => {
        if (fixHistory.length === 0) return;

        const lastFix = fixHistory[fixHistory.length - 1];
        try {
            // Revert the fix by applying original values
            if (lastFix.originalActions && lastFix.originalActions.length > 0) {
                await addOnUISdk.runtime.apiProxy('executeBulkFixes', lastFix.originalActions);
                addToast('Fix undone', 'success');
                
                // Restore violations
                setViolations(prev => [...prev, ...lastFix.violations]);
                
                // Remove from history
                setFixHistory(prev => prev.slice(0, -1));
            }
        } catch (error) {
            console.error('Error undoing fix:', error);
            addToast('Failed to undo fix', 'error');
        }
    }, [fixHistory, addOnUISdk, addToast]);

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
                // Store original state for undo (simplified - in production, capture actual values)
                const originalViolations = [violation];
                
                // Execute fixes via document sandbox
                const results = await addOnUISdk.runtime.apiProxy('executeBulkFixes', fixPlan.fix_plan.actions);

                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success && !r.skipped).length;
                const skipped = results.filter(r => r.skipped).length;

                if (successful > 0) {
                    // Add to fix history for undo
                    setFixHistory(prev => [...prev, {
                        violations: originalViolations,
                        actions: fixPlan.fix_plan.actions,
                        timestamp: Date.now()
                    }]);
                    
                    // Show toast with undo option
                    addToast(
                        `Fixed ${successful} issue${successful !== 1 ? 's' : ''}`,
                        'success',
                        5000,
                        handleUndoFix
                    );
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
                // Store for undo
                const originalViolations = [...violations];
                
                // Execute fixes via document sandbox
                const results = await addOnUISdk.runtime.apiProxy('executeBulkFixes', fixPlan.fix_plan.actions);

                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success && !r.skipped).length;
                const skipped = results.filter(r => r.skipped).length;

                if (successful > 0) {
                    // Add to fix history for undo
                    setFixHistory(prev => [...prev, {
                        violations: originalViolations,
                        actions: fixPlan.fix_plan.actions,
                        timestamp: Date.now()
                    }]);
                    
                    addToast(
                        `Fixed ${successful} issue${successful !== 1 ? 's' : ''}`,
                        'success',
                        5000,
                        handleUndoFix
                    );
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

                {/* Brand Profile Section */}
                <div className="brand-profile-section">
                    <div className="brand-profile-header">
                        <h3 className="section-title">Brand Profile</h3>
                        <Button 
                            size="s" 
                            onClick={() => setShowBrandProfileForm(!showBrandProfileForm)}
                            className="toggle-button"
                        >
                            {showBrandProfileForm ? 'Cancel' : 'Create/Edit Profile'}
                        </Button>
                    </div>

                    {showBrandProfileForm ? (
                        <div className="brand-profile-form">
                            <div className="form-group">
                                <label htmlFor="brand-statement">Brand Description</label>
                                <textarea
                                    id="brand-statement"
                                    className="brand-textarea"
                                    value={brandStatement}
                                    onChange={(e) => setBrandStatement(e.target.value)}
                                    placeholder="Describe your brand (e.g., 'Modern fintech startup for Gen Z')"
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="format">Design Format</label>
                                <select
                                    id="format"
                                    className="brand-select"
                                    value={format}
                                    onChange={(e) => setFormat(e.target.value)}
                                >
                                    <option value="instagram_post">Instagram Post</option>
                                    <option value="poster">Poster</option>
                                    <option value="story">Story</option>
                                    <option value="banner">Banner</option>
                                    <option value="flyer">Flyer</option>
                                </select>
                            </div>
                            <Button 
                                size="m" 
                                onClick={handleGenerateBrandProfile}
                                disabled={generatingProfile || !brandStatement.trim()}
                                className="generate-button"
                            >
                                {generatingProfile ? 'Generating...' : 'Generate Brand Profile'}
                            </Button>
                        </div>
                    ) : (
                        <div className="brand-profile-display">
                            <p className="brand-profile-info">
                                {localStorage.getItem('brand_statement') 
                                    ? `Current: "${localStorage.getItem('brand_statement')}"`
                                    : 'Using default brand profile. Create a new one to get started.'}
                            </p>
                            {brandProfile && (
                                <Button 
                                    size="s" 
                                    onClick={() => setShowBrandProfileEditor(!showBrandProfileEditor)}
                                    className="edit-profile-button"
                                >
                                    {showBrandProfileEditor ? 'Hide Details' : 'View/Edit Profile'}
                                </Button>
                            )}
                            {showBrandProfileEditor && brandProfile && (
                                <div className="brand-profile-editor">
                                    <div className="profile-section">
                                        <h4>Fonts</h4>
                                        <div className="profile-grid">
                                            <div>Heading: <strong>{brandProfile.fonts?.heading || 'N/A'}</strong></div>
                                            <div>Body: <strong>{brandProfile.fonts?.body || 'N/A'}</strong></div>
                                        </div>
                                    </div>
                                    <div className="profile-section">
                                        <h4>Colors</h4>
                                        <div className="color-preview-grid">
                                            {brandProfile.colors && Object.entries(brandProfile.colors).map(([key, value]) => (
                                                <div key={key} className="color-preview-item">
                                                    <div 
                                                        className="color-swatch" 
                                                        style={{ backgroundColor: value }}
                                                    />
                                                    <span className="color-label">{key}</span>
                                                    <span className="color-value">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button 
                                        size="s" 
                                        onClick={() => {
                                            const dataStr = JSON.stringify(brandProfile, null, 2);
                                            const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                            const url = URL.createObjectURL(dataBlob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = 'brand-profile.json';
                                            link.click();
                                            URL.revokeObjectURL(url);
                                            addToast('Brand profile exported', 'success');
                                        }}
                                        className="export-button"
                                    >
                                        Export Profile
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="actions-section">
                    <div className="primary-actions">
                        <Button 
                            size="m" 
                            onClick={handleCheckBrandConsistency}
                            disabled={loading || fixing}
                            className="primary-button"
                        >
                            {loading ? 'Checking...' : 'Check Brand Consistency'}
                        </Button>
                        <Button 
                            size="s" 
                            onClick={() => setWatchMode(!watchMode)}
                            className={`watch-mode-button ${watchMode ? 'active' : ''}`}
                            title={watchMode ? 'Disable auto-scan' : 'Enable auto-scan (watches for changes)'}
                        >
                            {watchMode ? '👁️ Watching' : '👁️ Watch'}
                        </Button>
                    </div>

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

                {loading && violations.length === 0 && (
                    <div className="violations-section">
                        <h3 className="section-title">Scanning Document...</h3>
                        <div className="violations-list">
                            <ViolationSkeleton />
                            <ViolationSkeleton />
                            <ViolationSkeleton />
                        </div>
                    </div>
                )}

                {violations.length > 0 && (
                    <div className="violations-section">
                        <h3 className="section-title">
                            Violations ({violations.length})
                            {violations.length > 50 && (
                                <span className="violation-count-warning"> (Large list - scrollable)</span>
                            )}
                        </h3>
                        <div className="violations-list">
                            {violations.map((violation, index) => (
                                <div 
                                    key={`${violation.element_id}-${violation.type}-${index}`}
                                    className={`violation-item ${hoveredViolation?.element_id === violation.element_id ? 'violation-hovered' : ''}`}
                                    style={{ borderLeftColor: getSeverityColor(violation.severity || 'warning') }}
                                    onMouseEnter={() => handleViolationHover(violation, true)}
                                    onMouseLeave={() => handleViolationHover(null, false)}
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
                    <div className="empty-state empty-state-success">
                        <div className="empty-state-icon">✨</div>
                        <h3>Perfect! No Violations Found</h3>
                        <p>Your design is fully brand-consistent! 🎉</p>
                        <p className="empty-state-subtitle">All elements match your brand profile guidelines.</p>
                    </div>
                )}

                {!hasChecked && !loading && (
                    <div className="welcome-state">
                        <div className="welcome-icon">👋</div>
                        <h3>Welcome to BrandGuard!</h3>
                        <p className="welcome-subtitle">Click "Check Brand Consistency" to analyze your design against your brand profile.</p>
                        <div className="welcome-features">
                            <div className="feature-item">✓ Font consistency</div>
                            <div className="feature-item">✓ Color palette</div>
                            <div className="feature-item">✓ Size guidelines</div>
                        </div>
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

                <ToastContainer toasts={toasts} removeToast={removeToast} onUndo={handleUndoFix} />
            </div>
        </Theme>
    );
};

export default App;