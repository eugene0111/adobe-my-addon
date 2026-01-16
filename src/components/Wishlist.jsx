import React from "react";

const Wishlist = ({ wishlistedItems, onBack, onSelect, onRemove }) => {
    return (
        <div className="wishlist-view fade-in">
            {/* Header for the Wishlist Panel */}
            <div className="view-header">
                <button className="back-arrow-btn" onClick={onBack}>← Back</button>
                <h3 className="view-title">Saved Brand Styles</h3>
            </div>

            <div className="wishlist-content">
                {wishlistedItems.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">❤️</span>
                        <p>No saved styles yet. Generate some and tap the heart to save them!</p>
                    </div>
                ) : (
                    <div className="wishlist-grid">
                        {wishlistedItems.map((item) => (
                            <div key={item.id} className="suggestion-card wishlist-card">
                                <div className="suggestion-header">
                                    <h4 className="suggestion-type">{item.name}</h4>
                                    <button 
                                        className="remove-wish-btn" 
                                        onClick={() => onRemove(item.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                <div className="asset-preview" style={{ height: '40px', marginBottom: '12px' }}>
                                    {item.colors ? (
                                        <div className="color-swatch-row">
                                            {item.colors.map((c, i) => (
                                                <div key={i} style={{ backgroundColor: c }} className="swatch" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="font-preview">{item.font}</div>
                                    )}
                                </div>

                                <button className="btn-fancy-submit" onClick={() => onSelect(item)}>
                                    Apply Style
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Wishlist;