import React, { useState, useRef } from "react"; // Added useRef
import Header from "./Header";
import IssueList from "./IssueList";
import Suggestions from "./Suggestions";
import Wishlist from "./Wishlist";
import { StatusLight } from "@swc-react/status-light";
import { Divider } from "@swc-react/divider";
import { Textfield } from "@swc-react/textfield";
import { generateBrandProfile } from "../services/api.js";
import { sendExtractedElements } from "../services/api.js";

const MainLinterUI = ({ issues, isScanning, onScan, onFix, setView, onTestExtract, extractedElements }) => {
    // --- State Management ---
    const [viewMode, setViewMode] = useState("dashboard"); // "dashboard" or "wishlist"
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestedAssets, setSuggestedAssets] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [wishlistedItems, setWishlistedItems] = useState([]);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    
    // Reference for the hidden file input
    const fileInputRef = useRef(null);

    const healthScore = Math.max(0, 100 - (issues.length * 12));
    const isBrandSafe = issues.length === 0;

    const handleSendElements = async () => {
        if (!extractedElements || extractedElements.length === 0) return;
        setSending(true);
        setSendResult(null);
        try {
            const resp = await sendExtractedElements(extractedElements);
            setSendResult({ ok: true, resp });
            console.log("[UI] 📤 Sent elements to backend:", resp);
        } catch (err) {
            setSendResult({ ok: false, err });
            console.warn("[UI] ⚠️ Failed to send elements:", err);
        } finally {
            setSending(false);
        }
    };
    // --- New Upload Handler ---
    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsGenerating(true);
        setShowSuggestions(true);

        try {
            console.log("Uploading guidelines:", file.name);
            // Here you would typically send the file to your backend 
            // example: const response = await uploadGuidelines(file);
            
            // Simulating a parsed result from a document
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

    // (handleSelectAsset, handleWishlistToggle, etc. remain the same)
    const handleSelectAsset = (asset) => {
        if (asset.isComplete && asset.profile && setBrandProfile) {
            setBrandProfile(asset.profile);
            setPrompt("");
            setShowSuggestions(false);
        }
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
                                <p className="assistant-description">
                                    Describe your vibe or upload your guidelines.
                                </p>
                            </div>
                            
                            {/* Hidden File Input */}
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
                                />
                                
                                <div className="action-group">
                                    <button 
                                        className="bubble-action-btn upload-btn" 
                                        onClick={handleUploadClick}
                                        title="Upload Guidelines"
                                    >
                                        📎
                                    </button>
                                    <button 
                                        className="bubble-submit" 
                                        onClick={handleGenerateBrand}
                                        disabled={isGenerating || !prompt}
                                    >
                                        {isGenerating ? "..." : "Generate"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {showSuggestions && (
                            <Suggestions 
                                assets={suggestedAssets} 
                                onSelect={handleSelectAsset} 
                                //onWishlist={handleWishlistToggle}
                                isLoading={isGenerating}
                            />
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

                    

                    {onTestExtract && (
                        <button 
                            className="scan-trigger-btn" 
                            onClick={onTestExtract}
                        >
                            Re-Scan Document
                        </button>
                    )}

                    
                    {extractedElements && extractedElements.length > 0 && (
                        <button
                            className="scan-trigger-btn"
                            onClick={handleSendElements}
                            disabled={sending}
                            style={{ marginLeft: "8px", backgroundColor: "#0a7a00", color: "white" }}
                        >
                            {sending ? "Sending..." : "Send Elements to Backend"}
                        </button>
                    )}
                    {extractedElements && extractedElements.length > 0 && (
                        <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#f0f0f0", borderRadius: "4px", fontSize: "12px" }}>
                            ✅ Found {extractedElements.length} element(s) - Check console for details
                        </div>
                    )}
                    {sendResult && (
                        <div style={{ marginTop: "8px", padding: "8px", borderRadius: "4px", fontSize: "12px", backgroundColor: sendResult.ok ? "#e8f5e9" : "#fdecea", color: sendResult.ok ? "#1b5e20" : "#b71c1c" }}>
                            {sendResult.ok ? "✅ Successfully sent elements to backend" : `❌ Failed to send elements: ${sendResult.err?.message || 'Unknown error'}`}
                        </div>
                    )}
                    {/* NEW: Detailed list of extracted elements */}
                    {extractedElements && extractedElements.length > 0 && (
                        <div style={{ marginTop: "12px", padding: "8px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
                            <div style={{ fontWeight: 600, marginBottom: "8px" }}>Extracted Elements Details</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                                {extractedElements.map((el, i) => (
                                    <div key={el.id || i} style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "8px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <div style={{ fontWeight: 600 }}>
                                                {el.type || "unknown"}
                                            </div>
                                            <div style={{ color: "#666" }}>ID: {el.id || "N/A"}</div>
                                        </div>
                                        {el.text && (
                                            <div style={{ marginTop: "4px" }}>
                                                <span style={{ fontWeight: 500 }}>Text:</span> {el.text}
                                            </div>
                                        )}
                                        {el.textStyle && (
                                            <div style={{ marginTop: "4px" }}>
                                                <span style={{ fontWeight: 500 }}>Font:</span> {el.textStyle.fontFamily || "N/A"} &nbsp; | &nbsp;
                                                <span style={{ fontWeight: 500 }}>Size:</span> {el.textStyle.fontSize ?? "N/A"} &nbsp; | &nbsp;
                                                <span style={{ fontWeight: 500 }}>Color:</span> {el.textStyle.color || "N/A"}
                                                {el.textStyle.color && (
                                                    <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: el.textStyle.color, marginLeft: "6px", verticalAlign: "middle", border: "1px solid #ccc" }} />
                                                )}
                                            </div>
                                        )}
                                        <div style={{ marginTop: "4px" }}>
                                            <span style={{ fontWeight: 500 }}>Position:</span> ({el.position?.x ?? 0}, {el.position?.y ?? 0}) &nbsp; | &nbsp;
                                            <span style={{ fontWeight: 500 }}>Size:</span> {el.size?.width ?? 0} × {el.size?.height ?? 0}
                                        </div>
                                        {el.fill && (
                                            <div style={{ marginTop: "4px" }}>
                                                <span style={{ fontWeight: 500 }}>Fill:</span> {typeof el.fill === "string" ? el.fill : JSON.stringify(el.fill)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MainLinterUI;