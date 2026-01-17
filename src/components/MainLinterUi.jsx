import React, { useState, useRef, useEffect } from 'react';
import Header from './Header';
import IssueList from './IssueList';
import Suggestions from './Suggestions';
import Wishlist from './Wishlist';
import MOCKBRANDPROFILE from '../utils/mockData.js';

// --- Fallback Components for swc-react (Fixes Module Not Found errors) ---
const StatusLight = ({ children, variant = 'positive', size = 's' }) => {
  const colors = {
    positive: '#1b5e20',
    negative: '#b71c1c',
    info: '#0277bd'
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
      <div style={{ 
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        backgroundColor: colors[variant] || colors.info 
      }} />
      <span>{children}</span>
    </div>
  );
};

const Divider = ({ size = 's', style = {} }) => (
  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '16px 0', ...style }} />
);

const Textfield = ({ value, onInput, className, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={onInput}
    className={className}
    style={{
      width: '100%',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '14px'
    }}
    placeholder={placeholder}
  />
);

// Fixed: generateBrandProfile is a named export, not default
import { generateBrandProfile, sendExtractedElements } from '../services/api.js';

const MainLinterUI = ({
  issues,
  setIssues,
  isScanning,
  onScan,
  onFix,
  setView,
  onTestExtract,
  extractedElements,
  addOnUISdk,
}) => {
  // --- State Management ---
  const [viewMode, setViewMode] = useState('dashboard');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedAssets, setSuggestedAssets] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wishlistedItems, setWishlistedItems] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const fileInputRef = useRef(null);

  // Dynamic health score
  const healthScore = Math.max(0, 100 - issues.length * 12);
  const isBrandSafe = issues.length === 0;

  // --- Automatic Sync Logic ---
  useEffect(() => {
    const syncElements = async () => {
      if (extractedElements && extractedElements.length > 0 && !sending) {
        await handleSendElements();
      }
    };
    syncElements();
  }, [extractedElements]);

  // --- Single Issue Fix Handler ---
  const handleFixSingleIssue = async (issue) => {
    try {
      console.log('[Add-on: BrandLint] [MainLinterUI] Fixing single issue:', issue);
  
      // 1. Re-validate to get fresh fixes from backend (UI layer = network)
      const validateResponse = await sendExtractedElements(extractedElements);
      console.log('[Add-on: BrandLint] [MainLinterUI] Validate response:', validateResponse);
  
      if (!validateResponse.success || !validateResponse.fixes?.actions) {
        console.error('[Add-on: BrandLint] [MainLinterUI] No fixes generated');
        return;
      }
  
      const allActions = validateResponse.fixes.actions;
  
      // 2. Pick the fix for this specific issue (id-normalized)
      const relevantAction = allActions.find((action) => {
        const actionId = action.element_id || action.elementid;
        const issueId = issue.element_id || issue.elementid;
        return actionId === issueId;
      });
  
      if (!relevantAction) {
        console.log('[Add-on: BrandLint] [MainLinterUI] No fix action for this issue');
        return;
      }
  
      console.log('✅ READY TO EXECUTE THIS EXACT FIX:', {
        element_id: relevantAction.element_id,
        action: relevantAction.action,
        value: relevantAction.value,
        description: relevantAction.description
      });
  
      // 3. Get sandbox proxy (Communication API, like Davide’s runtime.apiProxy('documentSandbox'))
      const runtime = addOnUISdk?.instance;
      if (!runtime || !runtime.apiProxy) {
        console.warn('[Add-on: BrandLint] [MainLinterUI] runtime.apiProxy not available');
      } else {
        try {
          const sandboxProxy = await runtime.apiProxy.documentSandbox;
          if (sandboxProxy) {
            // 4a. Try SINGLE executeFix (mirrors Davide’s createShape pattern)
            if (sandboxProxy.executeFix) {
              const singleResult = await sandboxProxy.executeFix(relevantAction);
              console.log('🎯 SANDBOX SINGLE FIX RESULT:', singleResult);
  
              if (singleResult?.success) {
                setIssues((prev) =>
                  prev.filter((i) => {
                    const iId = i.element_id || i.elementid;
                    const issueId = issue.element_id || issue.elementid;
                    return iId !== issueId;
                  })
                );
                console.log('✅ Fix applied via executeFix! Issue removed.');
                return;
              }
            }
  
            // 4b. Fallback: bulk with single action
            if (sandboxProxy.executeBulkFixes) {
              const bulkResults = await sandboxProxy.executeBulkFixes([relevantAction]);
              console.log('🎯 SANDBOX BULK FIX RESULT:', bulkResults);
              const first = Array.isArray(bulkResults) ? bulkResults[0] : null;
  
              if (first?.success) {
                setIssues((prev) =>
                  prev.filter((i) => {
                    const iId = i.element_id || i.elementid;
                    const issueId = issue.element_id || issue.elementid;
                    return iId !== issueId;
                  })
                );
                console.log('✅ Fix applied via executeBulkFixes! Issue removed.');
                return;
              }
            }
          }
        } catch (sandboxErr) {
          console.warn('[Add-on: BrandLint] [MainLinterUI] Sandbox auto-fix failed:', sandboxErr);
        }
      }
  
      // 5. Manual fallback – log precise instructions (no alert, Express blocks modals)
      const { dx = 0, dy = 0 } = relevantAction.value || {};
      console.log(`
  🚨 MANUAL FIX NEEDED (sandbox unavailable or failed):
  ====================================================
  1. Select element: ${relevantAction.element_id}
  2. Move by:
     - dx = ${dx}px
     - dy = ${dy}px
  3. Description: ${relevantAction.description}
  
  Apply this translation in the Properties panel.
  ====================================================
      `);
  
      // Optional: only remove if you consider manual fix “accepted”
      // For now, do NOT auto-remove to force re-scan once user adjusts manually.
      // If you want to remove anyway, uncomment:
      // setIssues((prev) =>
      //   prev.filter((i) => (i.element_id || i.elementid) !== (issue.element_id || issue.elementid))
      // );
  
    } catch (error) {
      console.error('[Add-on: BrandLint] [MainLinterUI] Error fixing issue:', error);
    }
  };
  ;
  

  const handleDismissIssue = (issue, index) => {
    setIssues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendElements = async () => {
    if (!extractedElements || extractedElements.length === 0) return;
    setSending(true);
    setSendResult(null);

    try {
      const resp = await sendExtractedElements(extractedElements);
      if (resp.success && resp.violations) {
        const enhancedViolations = await Promise.all(
          resp.violations.map(async (violation) => {
            const targetId = violation.element_id || violation.elementid;
            if (targetId) {
              try {
                const elementInfo = await addOnUISdk.app.runtime.proxy.highlightElement(targetId);
                if (elementInfo?.success) {
                  const elementType = elementInfo.elementTypeName || 'element';
                  const location = elementInfo.humanLocation || 'canvas';
                  
                  // Get position coordinates
                  let positionText = '';
                  if (elementInfo.position && typeof elementInfo.position.x === 'number' && typeof elementInfo.position.y === 'number') {
                    const x = Math.round(elementInfo.position.x);
                    const y = Math.round(elementInfo.position.y);
                    positionText = `(${x}, ${y})`;
                  }
                  
                  // Build clear message: "[Element type] at [top-right/top-left/etc] (x, y): [error message]"
                  // Format: "rectangle at top-right (450, 120): overlaps with another element"
                  let enhancedMessage = `${elementType} at ${location}`;
                  if (positionText) {
                    enhancedMessage += ` ${positionText}`;
                  }
                  enhancedMessage += `: ${violation.message}`;

                  return {
                    ...violation,
                    message: enhancedMessage,
                    humanLocation: elementInfo.humanLocation,
                    elementTypeName: elementInfo.elementTypeName,
                    position: elementInfo.position,
                  };
                }
              } catch (err) {
                console.warn('[Add-on: BrandLint] Could not get element info:', err);
              }
            }
            return violation;
          })
        );
        setIssues(enhancedViolations);
      } else {
        setIssues([]);
      }
      setSendResult({ ok: true, resp });
    } catch (err) {
      setSendResult({ ok: false, err });
      console.warn('Sync failed.', err);
    } finally {
      setSending(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsGenerating(true);
    setShowSuggestions(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuggestedAssets([
        { id: 'upload-1', name: 'Parsed Brand Colors', colors: ['#1A1A1A', '#FFFFFF', '#46C34C'] },
        { id: 'upload-2', name: 'Guidelines Font', font: 'Adobe Clean' },
      ]);
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectElement = async (elementId) => {
    if (!elementId || !addOnUISdk) return;
    try {
      const result = await addOnUISdk.app.runtime.proxy.highlightElement(elementId);
      if (result?.success) {
        alert(result.guidanceMessage || result.message);
      }
    } catch (error) {
      console.error('Error selecting element', error);
    }
  };

  const handleGenerateBrand = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setShowSuggestions(true);
    try {
      const response = await generateBrandProfile(prompt.trim(), 'instagram-post');
      if (response.success && response.brand_profile) {
        const profile = response.brand_profile;
        const assets = [];
        if (profile.colors) {
          assets.push({
            id: 'color-palette',
            name: `${profile.brand_name} Generated Palette`,
            colors: [profile.colors.primary, profile.colors.secondary, profile.colors.accent].filter(Boolean),
          });
        }
        setSuggestedAssets(assets);
      }
    } catch (error) {
      console.error('Error generating brand', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAsset = (asset) => {
    setViewMode('dashboard');
    setTimeout(onScan, 100);
  };

  return (
    <div className="grammarly-dashboard fade-in">
      <Header
        onWishlistClick={() => setViewMode('wishlist')}
        onLogout={() => setView('welcome')}
      />

      {viewMode === 'wishlist' ? (
        <div className="grammarly-content">
          <Wishlist
            wishlistedItems={wishlistedItems}
            onBack={() => setViewMode('dashboard')}
            onSelect={handleSelectAsset}
            onRemove={(id) => setWishlistedItems((items) => items.filter((i) => i.id !== id))}
          />
        </div>
      ) : (
        <div className="grammarly-content">
          <div className="assistant-bubble">
            <div className="bubble-header">
              <h4 className="assistant-title">AI Brand Stylist</h4>
              <p className="assistant-description">Describe your vibe or upload your guidelines.</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileChange}
            />
            <div className="bubble-input-row">
              <Textfield
                value={prompt}
                onInput={(e) => setPrompt(e.target.value)}
                className="bubble-field"
                placeholder="e.g. Minimalist tech startup"
              />
            </div>
            <div className="action-group">
              <button className="bubble-action-btn upload-btn" onClick={handleUploadClick}>
                Upload Guidelines
              </button>
              <button
                className="bubble-submit"
                onClick={handleGenerateBrand}
                disabled={isGenerating || !prompt}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {showSuggestions && (
            <Suggestions assets={suggestedAssets} onSelect={handleSelectAsset} isLoading={isGenerating} />
          )}

          <div className={`floating-health ${isBrandSafe ? 'safe' : 'action-needed'}`}>
            <div className="health-left">
              <div className="health-circle">
                <span className="health-val">{isScanning ? '...' : healthScore}</span>
              </div>
            </div>
            <div className="health-text">
              <p className="health-status-label">Overall Health</p>
              <StatusLight size="s" variant={isBrandSafe ? 'positive' : 'negative'}>
                {isBrandSafe ? 'Great work!' : `${issues.length} suggestions`}
              </StatusLight>
            </div>
          </div>

          {!isBrandSafe && (
            <button className="grammarly-fix-btn" onClick={onFix}>Fix All</button>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <p className="feed-header">Suggestions</p>
          {isBrandSafe ? (
            <div className="celebration-box">
              <p>Your design is perfectly on-brand!</p>
            </div>
          ) : (
            <IssueList
              issues={issues}
              onSelectElement={handleSelectElement}
              onFixIssue={handleFixSingleIssue}
              onDismissIssue={handleDismissIssue}
            />
          )}
        </div>
      )}

      <div className="grammarly-footer">
        <button
          className="scan-trigger-btn"
          onClick={onTestExtract}
          disabled={isScanning || sending}
        >
          {isScanning ? 'Checking Layers...' : sending ? 'Syncing...' : 'Re-Scan Document'}
        </button>
        {sendResult && (
          <div style={{ marginTop: '8px', fontSize: '11px', textAlign: 'center', color: sendResult.ok ? '#1b5e20' : '#b71c1c' }}>
            {sendResult.ok ? 'Document Synced' : 'Sync Failed'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLinterUI;
