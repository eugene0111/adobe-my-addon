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
  onFix,
  setView,
  onTestExtract,
  addOnUISdk,
}) => {
  // --- State Management ---
  const [viewMode, setViewMode] = useState('dashboard');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedAssets, setSuggestedAssets] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wishlistedItems, setWishlistedItems] = useState([]);
  
  // Local processing state (replaces App.jsx scanning state)
  const [isProcessing, setIsProcessing] = useState(false);
  
  // AI Brand Profile State
  const [activeBrandProfile, setActiveBrandProfile] = useState(null);
  const [generatedFullProfile, setGeneratedFullProfile] = useState(null);

  const fileInputRef = useRef(null);

  // Dynamic health score
  const healthScore = Math.max(0, 100 - issues.length * 12);
  const isBrandSafe = issues.length === 0;

  // --- 1. CORE VALIDATION LOGIC ---
  const performValidation = async (elements) => {
    if (activeBrandProfile) {
      try {
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
      return sendExtractedElements(elements);
    }
  };

  // --- 2. DATA PROCESSING HANDLER ---
  const processDocumentUpdate = async (elements) => {
    // Prevent overlapping checks
    if (isProcessing || !elements) return;

    setIsProcessing(true);
    try {
      // Validate the data received from Sandbox
      const resp = await performValidation(elements);
      
      if (resp.success && resp.violations) {
        // Map violations for UI
        const processedIssues = resp.violations.map(v => ({
          ...v,
          humanLocation: v.humanLocation || 'canvas' 
        }));
        setIssues(processedIssues);
      } else {
        setIssues([]);
      }
    } catch (err) {
      console.warn('Live validation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. REAL-TIME EVENT LISTENER (PUSH ARCHITECTURE) ---
  useEffect(() => {
    let cleanupListener = () => {};

    const initRealtimeConnection = async () => {
      if (!addOnUISdk?.instance?.runtime) return;

      const { runtime } = addOnUISdk.instance;
      
      try {
        // A. Get Sandbox Proxy
        const sandboxApi = await runtime.apiProxy("documentSandbox");
        
        // B. Define the Event Handler
        const handleDocumentUpdated = async (data) => {
            // Support both direct array or object wrapper
            const elements = data.elements || data;
            // console.log("[UI] Received update:", elements?.length);
            await processDocumentUpdate(elements);
        };

        // C. Subscribe to Sandbox Events
        // We look for 'DOCUMENT_UPDATED' emitted by our new code.js
        if (runtime.on) {
            runtime.on("DOCUMENT_UPDATED", handleDocumentUpdated);
            cleanupListener = () => runtime.off("DOCUMENT_UPDATED", handleDocumentUpdated);
        }

        // D. Start the Watcher in Sandbox
        // This tells code.js to start its internal loop/listeners
        if (sandboxApi.startRealtimeScan) {
            await sandboxApi.startRealtimeScan();
            console.log("[UI] Real-time watcher started.");
        } else {
            console.warn("[UI] startRealtimeScan not found in sandbox API. Check code.js.");
        }

      } catch (err) {
        console.error("[UI] Failed to init real-time connection:", err);
      }
    };

    initRealtimeConnection();

    return () => {
      cleanupListener();
    };
  }, [addOnUISdk]); 

  // --- Handlers ---
  const handleFixSingleIssue = async (issue) => {
    try {
      // For fixing, we might need fresh data or just trust the issue ID
      // We'll proceed with the existing action logic
      const { runtime } = addOnUISdk.instance;
      if (!runtime) return;
      
      const sandboxApi = await runtime.apiProxy("documentSandbox");
      
      // Need to find the action again. In a real app, you might store actions with issues.
      // Retriggering validation to find the specific action for this issue ID:
      const validation = await performValidation(issues.map(i => ({ id: i.element_id }))); 
      // Note: The above is a simplification. Ideally, pass the full extracted elements if stored.
      // For now, let's assume we can re-fetch or use a stored 'extractedElements' state if we lifted it back here.
      // But to keep it simple and robust:
      
      // Better approach: Just tell sandbox to fix this ID using generic logic if available,
      // OR re-scan completely. 
      // Let's rely on re-scanning via the fix button triggers in IssueList usually calling 'onFix'.
      
      // If we must fix a single issue here:
      if (sandboxApi.executeFix) {
          // Construct a basic action or fetch from backend
          // Falling back to a "Fix All" strategy for the single element if specific action missing
          // But likely you have the action data. 
          // Assuming 'performValidation' was just called in processDocumentUpdate, we don't have the actions stored.
          // Let's do a quick fetch:
          const latestData = await sandboxApi.extractDocumentData();
          const resp = await performValidation(latestData.elements || latestData);
          
          if (resp.fixes?.actions) {
             const action = resp.fixes.actions.find(a => (a.element_id || a.elementid) === (issue.element_id || issue.elementid));
             if (action) {
                 await sandboxApi.executeFix(action);
                 // The sandbox will emit DOCUMENT_UPDATED after fix, updating the UI automatically.
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
    // We don't need to manually scan here; the real-time connection is active.
    // But we can force a check if we want immediate feedback:
    // onTestExtract && onTestExtract(); 
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
              <button className="bubble-action-btn upload-btn" onClick={() => fileInputRef.current?.click()}>
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

      {/* FOOTER: LIVE STATUS BADGE */}
      <div className="grammarly-footer" style={{ 
          marginTop: 'auto', 
          padding: '10px', 
          borderTop: '1px solid #eee',
          display: 'flex', 
          justifyContent: 'center', 
          background: '#f9f9f9',
          minHeight: '40px'
      }}>
        <div style={{ 
            fontSize: '11px', 
            fontWeight: '600',
            color: isProcessing ? '#e65100' : '#2e7d32', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
        }}>
            <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: isProcessing ? '#ff9800' : '#2e7d32',
                boxShadow: isProcessing ? '0 0 4px #ff9800' : '0 0 0 2px rgba(46, 125, 50, 0.2)',
                animation: 'pulse 1.5s infinite'
            }} />
            {isProcessing ? 'ANALYZING...' : 'LIVE MONITORING ACTIVE'}
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default MainLinterUI;
