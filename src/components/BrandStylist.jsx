import React, { useState } from 'react';
import { generateBrandKit } from '../services/api';
import './BrandStylist.css'; // You might need to create a simple CSS file or use inline styles

const BrandStylist = ({ onApplyBrand }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedBrand, setGeneratedBrand] = useState(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        
        try {
            const data = await generateBrandKit(url);
            setGeneratedBrand(data);
        } catch (err) {
            setError('Could not analyze this brand. Please check the URL.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="brand-stylist-container">
            <h3>AI Brand Stylist</h3>
            <p className="description">Enter your website to automatically generate a brand kit and style your design.</p>
            
            <div className="input-group">
                <input 
                    type="url" 
                    placeholder="https://example.com" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="spectrum-Textfield"
                />
                <button 
                    onClick={handleAnalyze} 
                    disabled={loading || !url}
                    className="spectrum-Button spectrum-Button--cta"
                >
                    {loading ? 'Analyzing...' : 'Analyze Brand'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {generatedBrand && (
                <div className="brand-results">
                    <h4>Brand Detected</h4>
                    <div className="colors-preview">
                        {generatedBrand.colors?.map((color, idx) => (
                            <div 
                                key={idx} 
                                className="color-swatch" 
                                style={{ backgroundColor: color }} 
                                title={color}
                            />
                        ))}
                    </div>
                    {/* Add Fonts or Logo previews here if your backend returns them */}
                    
                    <button 
                        onClick={() => onApplyBrand(generatedBrand)}
                        className="spectrum-Button spectrum-Button--primary"
                        style={{ marginTop: '10px' }}
                    >
                        Apply to Design
                    </button>
                </div>
            )}
        </div>
    );
};

export default BrandStylist;