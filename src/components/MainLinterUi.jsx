import React, { useState, useRef, useEffect } from "react";
import Header from "./Header";
import IssueList from "./IssueList";
import Suggestions from "./Suggestions";
import Wishlist from "./Wishlist";
import { StatusLight } from "@swc-react/status-light";
import { Divider } from "@swc-react/divider";
import { Textfield } from "@swc-react/textfield";
import { generateBrandProfile, sendExtractedElements } from "../services/api.js";

const MainLinterUI = ({ 
    issues, 
    setIssues, // Added setIssues prop to update suggestions feed
    isScanning, 
    onScan, 
    onFix, 
    setView, 
    onTestExtract, 
    extractedElements 
}) => {
    // --- State Management ---
    const [viewMode, setViewMode] = useState("dashboard");
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestedAssets, setSuggestedAssets] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [wishlistedItems, setWishlistedItems] = useState([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    
    const fileInputRef = useRef(null);

    // Dynamic health score based on backend violation count
    const healthScore = Math.max(0, 100 - (issues.length * 12));
    const isBrandSafe = issues.length === 0;

    // --- Automatic Sync Logic ---
    // This effect ensures that as soon as onTestExtract finishes, data is sent to the API
    useEffect(() => {
        const syncElements = async () => {
            if (extractedElements && extractedElements.length > 0 && !sending) {
                await handleSendElements();
            }
        };
        syncElements();
    }, [extractedElements]);

    /**
     * Sends extracted document layers to backend and updates the UI suggestions
     */
    const handleSendElements = async () => {
        if (!extractedElements || extractedElements.length === 0) return;
        
        setSending(true);
        setSendResult(null);
        
        try {
            // 1. Call Express backend
            const resp = await sendExtractedElements(extractedElements);
            
            // 2. Map "violations" array from backend to the Suggestions feed
            if (resp && resp.success && resp.violations) {
                setIssues(resp.violations); 
                console.log(`[UI] Received ${resp.violations.length} violations from API`);
            } else {
                setIssues([]); // Clear issues if document is clean
            }
            
            setSendResult({ ok: true, resp });
        } catch (err) {
            setSendResult({ ok: false, err });
            console.warn("[UI] ⚠️ Sync failed. Check if backend server is running.", err);
        } finally {
            setSending(false);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsGenerating(true);
        setShowSuggestions(true);

        try {
            // Simulating parsing delay
            setTimeout(() => {
                const assets = [
                    { id: 'upload-1', name: "Parsed Brand Colors", colors: ["#1A1A1A", "#FFFFFF", "#46C34C"] },
                    { id: 'upload-2', name: "Guidelines Font", font: "Adobe Clean" }
                ];
                setSuggestedAssets(assets);
                setIsGenerating(false);
            }, 1500);
        } catch (error) {
            console.error("Upload failed:", error);
            setIsGenerating(false);
        }
    };

    const handleGenerateBrand = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setShowSuggestions(true);

        try {
            const response = await generateBrandProfile(prompt.trim(), 'instagram_post');
            if (response.success && response.brand_profile) {
                const profile = response.brand_profile;
                const assets = [];
                if (profile.colors) {
                    assets.push({
                        id: 'color-palette',
                        name: `${profile.brand_name || 'Generated'} Palette`,
                        colors: [profile.colors.primary, profile.colors.secondary, profile.colors.accent].filter(Boolean)
                    });
                }
                setSuggestedAssets(assets);
            }
        } catch (error) {
            console.error("Error generating brand:", error);
        }
        setIsGenerating(false);
    };

    const handleSelectAsset = (asset) => {
        setViewMode("dashboard");
        setTimeout(() => onScan(), 100);
    };

    return (
        <div className="grammarly-dashboard fade-in">
            <Header 
                onWishlistClick={() => setViewMode("wishlist")} 
                onLogout={() => setView("welcome")}
            />

            <div className="grammarly-content">
                {viewMode === "wishlist" ? (
                    <Wishlist 
                        wishlistedItems={wishlistedItems}
                        onBack={() => setViewMode("dashboard")}
                        onSelect={handleSelectAsset}
                        onRemove={(id) => setWishlistedItems(items => items.filter(i => i.id !== id))}
                    />
                ) : (
                    <>
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
                                    placeholder="e.g. Minimalist tech startup with deep blues"
                                />
                                <div className="action-group">
                                    <button className="bubble-action-btn upload-btn" onClick={handleUploadClick} title="Upload Guidelines">📎</button>
                                    <button className="bubble-submit" onClick={handleGenerateBrand} disabled={isGenerating || !prompt}>
                                        {isGenerating ? "..." : "Generate"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {showSuggestions && (
                            <Suggestions assets={suggestedAssets} onSelect={handleSelectAsset} isLoading={isGenerating} />
                        )}

                        <div className={`floating-health ${isBrandSafe ? 'safe' : 'action-needed'}`}>
                            <div className="health-left">
                                <div className="health-circle"><span className="health-val">{isScanning ? "..." : healthScore}</span></div>
                                <div className="health-text">
                                    <p className="health-status-label">Overall Health</p>
                                    <StatusLight size="s" variant={isBrandSafe ? "positive" : "negative"}>
                                        {isBrandSafe ? "Great work!" : `${issues.length} suggestions`}
                                    </StatusLight>
                                </div>
                            </div>
                            {!isBrandSafe && <button className="grammarly-fix-btn" onClick={onFix}>Fix All</button>}
                        </div>

                        <Divider size="s" style={{ margin: '16px 0' }} />

                        <div className="suggestion-feed">
                            <p className="feed-header">Suggestions</p>
                            {isBrandSafe ? (
                                <div className="celebration-box"><p>Your design is perfectly on-brand!</p></div>
                            ) : (
                                <IssueList issues={issues} />
                            )}
                        </div>
                    </>
                )}
            </div>

            {viewMode === "dashboard" && (
                <div className="grammarly-footer">
                    <button 
                        className="scan-trigger-btn" 
                        onClick={onTestExtract}
                        disabled={isScanning || sending}
                    >
                        {isScanning ? "Checking Layers..." : sending ? "Syncing..." : "Re-Scan Document"}
                    </button>

                    {sendResult && (
                        <div style={{ 
                            marginTop: "8px", 
                            fontSize: "11px", 
                            textAlign: "center", 
                            color: sendResult.ok ? "#1b5e20" : "#b71c1c" 
                        }}>
                            {sendResult.ok ? "✅ Document Synced" : "❌ Sync Failed"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MainLinterUI;