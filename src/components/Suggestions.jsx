import React from "react";

const Suggestions = ({ assets, onSelect, isLoading, wishlistedIds = [], onWishlist }) => {
    // Create an array of 3 items to show as skeletons during loading
    const skeletons = [1, 2, 3];

    return (
        <div className="asset-suggestions-container fade-in">
            <p className="feed-header">AI Style Suggestions</p>
            <div className="asset-scroll-row">
                {isLoading ? (
                    // 1. Render Skeleton Cards while generating
                    skeletons.map((_, i) => (
                        <div key={`skeleton-${i}`} className="asset-card skeleton-card">
                            <div className="asset-preview skeleton-shimmer"></div>
                            <div className="skeleton-text skeleton-shimmer"></div>
                            <div className="skeleton-btn-row">
                                <div className="skeleton-btn-sm skeleton-shimmer"></div>
                                <div className="skeleton-btn-lg skeleton-shimmer"></div>
                            </div>
                        </div>
                    ))
                ) : (
                    // 2. Render Actual Assets once ready
                    assets.map((asset) => (
                        <div key={asset.id} className="asset-card">
                            <div className="asset-preview">
                                {asset.colors ? (
                                    <div className="color-swatch-row">
                                        {asset.colors.map((c, i) => (
                                            <div 
                                                key={`${asset.id}-color-${i}`} 
                                                style={{ backgroundColor: c }} 
                                                className="swatch"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="font-preview">{asset.font}</div>
                                )}
                            </div>
                            
                            <h5 className="asset-name">{asset.name}</h5>
                            
                            <div className="asset-actions">
                                <div className="action-group-left">
                                <button 
    className={`asset-btn wishlist ${wishlistedIds.includes(asset.id) ? 'active' : ''}`} 
    onClick={() => onWishlist(asset)}
>
    {wishlistedIds.includes(asset.id) ? "❤️" : "🤍"}
</button>
                                    <button 
                                        className="asset-btn edit" 
                                        onClick={() => console.log("Edit:", asset.id)}
                                    >
                                        ✎
                                    </button>
                                </div>
                                <button 
                                    className="asset-btn select" 
                                    onClick={() => onSelect(asset)}
                                >
                                    Select
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Suggestions;