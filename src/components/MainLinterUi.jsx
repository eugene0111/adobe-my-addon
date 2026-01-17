import React, { useState, useRef, useEffect } from 'react';
import Header from './Header';
import IssueList from './IssueList';
import Suggestions from './Suggestions';
import Wishlist from './Wishlist';
import { BACKEND_URL } from '../config.js';
import { generateBrandProfile, sendExtractedElements } from '../services/api.js';

// --- UI Helpers ---
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

const Divider = ({ style = {} }) => (
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
  
  // AI Brand Profile State
  const [activeBrandProfile, setActiveBrandProfile] = useState(null);
  const [generatedFullProfile, setGeneratedFullProfile] = useState(null);

  const fileInputRef = useRef(null);

  // Dynamic health score
  const healthScore = Math.max(0, 100 - issues.length * 12);
  const isBrandSafe = issues.length === 0;

  // --- 1. CORE VALIDATION LOGIC ---
  // This ensures we validate against the AI profile if one exists
  const performValidation = async (elements) => {
    if (activeBrandProfile) {
      try {
        console.log('[MainLinterUI] Validating against Active AI Profile:', activeBrandProfile.brand_name);
        const response = await fetch(`${BACKEND_URL}/brand/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_data: { elements },
            brand_profile: activeBrandProfile 
          }),
        });
        return await response.json();
      } catch (error) {
        console.error('Custom validation failed:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Fallback to default/hardcoded profile in API service
      return sendExtractedElements(elements);
    }
  };

  // --- 2. SYNC LOGIC ---
  // When App.jsx extracts elements (after you click the button), this picks them up
  useEffect(() => {
    const syncElements = async () => {
      if (extractedElements && extractedElements.length > 0 && !sending) {
        await handleSendElements();
      }
    };
    syncElements();
  }, [extractedElements]);

  // --- Handlers ---

  const handleSendElements = async () => {
    if (!extractedElements || extractedElements.length === 0) return;
    setSending(true);
    setSendResult(null);

    try {
      const resp = await performValidation(extractedElements);
      
      if (resp.success && resp.violations) {
        const enhancedViolations = resp.violations.map((violation) => {
             // Add human readable location fallback
             return {
                ...violation,
                humanLocation: violation.humanLocation || 'canvas'
             };
        });
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

  const handleFixSingleIssue = async (issue) => {
    try {
      // Re-validate to get the latest fix actions
      const validateResponse = await performValidation(extractedElements);
      
      if (!validateResponse.success || !validateResponse.fixes?.actions) return;
  
      const relevantAction = validateResponse.fixes.actions.find(a => 
        (a.element_id || a.elementid) === (issue.element_id || issue.elementid)
      );
  
      if (!relevantAction) return;
  
      const runtime = addOnUISdk?.instance;
      if (runtime?.apiProxy) {
        const sandboxProxy = await runtime.apiProxy.documentSandbox;
        if (sandboxProxy?.executeFix) {
          const res = await sandboxProxy.executeFix(relevantAction);
          if (res?.success) {
            // Optimistic Update: Remove from list immediately
            setIssues(prev => prev.filter(i => 
              (i.element_id || i.elementid) !== (issue.element_id || issue.elementid)
            ));
          }
        }
      }
    } catch (error) {
      console.error('Fix error:', error);
    }
  };

  const handleGenerateBrand = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setShowSuggestions(true);
    try {
      const response = await generateBrandProfile(prompt.trim(), 'instagram-post');
      if (response && (response.brand_profile || response.success)) {
        const profile = response.brand_profile || response; 
        setGeneratedFullProfile(profile);
        setActiveBrandProfile(profile);
        
        setSuggestedAssets([{
          id: 'generated-brand-colors',
          name: `${profile.brand_name || 'AI'} Palette`,
          colors: [profile.colors.primary, profile.colors.secondary, profile.colors.accent].filter(Boolean),
          type: 'palette'
        }]);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAsset = (asset) => {
    if (asset.id.startsWith('generated') && generatedFullProfile) {
        setActiveBrandProfile(generatedFullProfile);
    }
    setViewMode('dashboard');
    // We switched profile, user should probably re-scan manually
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // --- Render ---
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
            onRemove={(id) => setWishlistedItems(items => items.filter(i => i.id !== id))}
          />
        </div>
      ) : (
        <div className="grammarly-content">
          <div className="assistant-bubble">
            <div className="bubble-header">
              <h4 className="assistant-title">AI Brand Stylist</h4>
              <p className="assistant-description">Describe your vibe or upload your guidelines.</p>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={() => {}} />
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
                <span className="health-val">{healthScore}</span>
              </div>
            </div>
            <div className="health-text">
              <p className="health-status-label">
                  {activeBrandProfile ? 'Brand Health (AI Active)' : 'Brand Health'}
              </p>
              <StatusLight size="s" variant={isBrandSafe ? 'positive' : 'negative'}>
                {isBrandSafe ? 'All good!' : `${issues.length} suggestions`}
              </StatusLight>
            </div>
          </div>

          {!isBrandSafe && (
            <button className="grammarly-fix-btn" onClick={onFix}>Fix All</button>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <p className="feed-header">Issues</p>
          {isBrandSafe ? (
            <div className="celebration-box"><p>No brand violations found.</p></div>
          ) : (
            <IssueList
              issues={issues}
              onSelectElement={(id) => addOnUISdk?.app?.runtime?.proxy?.highlightElement(id)}
              onFixIssue={handleFixSingleIssue}
              onDismissIssue={(issue, idx) => setIssues(prev => prev.filter((_, i) => i !== idx))}
            />
          )}
        </div>
      )}

      {/* FOOTER: MANUAL RE-SCAN BUTTON */}
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
