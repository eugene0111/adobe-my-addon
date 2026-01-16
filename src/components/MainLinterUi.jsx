import React, { useState } from "react";
import Header from "./Header";
import IssueList from "./IssueList";
import Suggestions from "./Suggestions";
import Wishlist from "./Wishlist"; // Import the new component
import { StatusLight } from "@swc-react/status-light";
import { Divider } from "@swc-react/divider";
import { Textfield } from "@swc-react/textfield";

const MainLinterUI = ({ issues, isScanning, onScan, onFix, setView, onTestExtract, extractedElements }) => {
    // --- State Management ---
    const [viewMode, setViewMode] = useState("dashboard"); // "dashboard" or "wishlist"
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestedAssets, setSuggestedAssets] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [wishlistedItems, setWishlistedItems] = useState([]);

    // --- Metrics ---
    // Health Score calculation: $Score = \max(0, 100 - (n_{issues} \times 12))$
    const healthScore = Math.max(0, 100 - (issues.length * 12));
    const isBrandSafe = issues.length === 0;

    // --- Handlers ---
    const handleGenerateBrand = async () => {
        setIsGenerating(true);
        setShowSuggestions(true);
        setTimeout(() => {
            const mockAssets = [
                { id: 1, name: "Vibrant Tech", colors: ["#6366f1", "#a855f7", "#ec4899"] },
                { id: 2, name: "Modern Sans", font: "Inter ExtraBold" },
                { id: 3, name: "Deep Marine", colors: ["#0f172a", "#334155", "#94a3b8"] },
                { id: 4, name: "Eco Leaf", colors: ["#059669", "#10b981", "#6ee7b7"] }
            ];
            setSuggestedAssets(mockAssets);
            setIsGenerating(false);
        }, 1500);
    };

    const handleSelectAsset = (asset) => {
        console.log("Applying style:", asset);
        setViewMode("dashboard"); // Switch back to dashboard if applied from wishlist
        onScan(); 
    };

    const handleWishlistToggle = (asset) => {
        setWishlistedItems((prev) => {
            const isAlreadySaved = prev.some(item => item.id === asset.id);
            if (isAlreadySaved) {
                return prev.filter(item => item.id !== asset.id); // Remove
            }
            return [...prev, asset]; // Add
        });
    };

    return (
        <div className="grammarly-dashboard fade-in">
            {/* 1. Header with View Switching */}
            <Header 
                onWishlistClick={() => setViewMode("wishlist")} 
                onLogout={() => setView("welcome")}
                onPreferencesClick={() => console.log("Preferences")}
            />

            <div className="grammarly-content">
                {viewMode === "wishlist" ? (
                    /* 2. Wishlist View Mode */
                    <Wishlist 
                        wishlistedItems={wishlistedItems}
                        onBack={() => setViewMode("dashboard")}
                        onSelect={handleSelectAsset}
                        onRemove={(id) => setWishlistedItems(items => items.filter(i => i.id !== id))}
                    />
                ) : (
                    /* 3. Standard Dashboard Mode */
                    <>
                        <div className="assistant-bubble">
                            <div className="bubble-header">
                                <div className="title-row">
                                    <h4 className="assistant-title">AI Brand Stylist</h4>
                                </div>
                                <p className="assistant-description">
                                    Let's make your design consistent and on-brand.
                                </p>
                            </div>
                            <div className="bubble-input-row">
                                <Textfield 
                                    
                                    value={prompt}
                                    onInput={(e) => setPrompt(e.target.value)}
                                    className="bubble-field"
                                />
                                <button 
                                    className="bubble-submit" 
                                    onClick={handleGenerateBrand}
                                    disabled={isGenerating || !prompt}
                                >
                                    {isGenerating ? "..." : "Generate"}
                                </button>
                            </div>
                        </div>

                        {showSuggestions && (
                            <Suggestions 
                                assets={suggestedAssets} 
                                onSelect={handleSelectAsset} 
                                onWishlist={handleWishlistToggle}
                                isLoading={isGenerating}
                                //wishlistedIds={wishlistedItems.map(i => i.id)}
                            />
                        )}

                        <div className={`floating-health ${isBrandSafe ? 'safe' : 'action-needed'}`}>
                            <div className="health-left">
                                <div className="health-circle">
                                    <span className="health-val">{isScanning ? "..." : healthScore}</span>
                                </div>
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
                                <div className="celebration-box">
                                    <p>Your design is perfectly on-brand!</p>
                                </div>
                            ) : (
                                <IssueList issues={issues} />
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Sticky Footer - Hidden in Wishlist for cleaner UX */}
            {viewMode === "dashboard" && (
                <div className="grammarly-footer">
                    <button className="scan-trigger-btn" onClick={onScan} disabled={isScanning}>
                        {isScanning ? "Checking Layers..." : "Re-Scan Document"}
                    </button>
                    {onTestExtract && (
                        <button 
                            className="scan-trigger-btn" 
                            onClick={onTestExtract}
                            style={{ marginLeft: "8px", backgroundColor: "#0066cc", color: "white" }}
                        >
                            Test Extract Elements
                        </button>
                    )}
                    {extractedElements && extractedElements.length > 0 && (
                        <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#f0f0f0", borderRadius: "4px", fontSize: "12px" }}>
                            ✅ Found {extractedElements.length} element(s) - Check console for details
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