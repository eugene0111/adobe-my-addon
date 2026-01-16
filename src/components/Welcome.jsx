import React, { useState } from "react";
import "./App.css";

const Welcome = ({ onStart, onLoginClick }) => {
    const [step, setStep] = useState(1);

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
        } else {
            // This triggers the transition to the main Dashboard (Linter UI)
            onStart(); 
        }
    };

    const handleBack = () => {
        if (step === 2) setStep(1);
    };

    return (
        <div className="welcome-container">
            {/* Dynamic height class for smooth elongation */}
            <div className={`welcome-box ${step === 2 ? "elongated" : "compact"}`}>
                
                {/* 1. Navigation Header */}
                <div className="nav-header">
                    <button className="nav-arrow" onClick={handleBack} disabled={step === 1}>
                        ←
                    </button>
                    <button className="nav-arrow" onClick={handleNext} disabled={step === 2}>
                        →
                    </button>
                </div>

                {/* 2. Slide Content */}
                <div className="content-wrapper">
                    {step === 1 ? (
                        <div className="slide-content fade-in">
                            
                            <h1 className="brand-title">Ready to BrandLint?</h1>
                            <p className="brand-subtitle">
                                Login to sync your custom brand guidelines or start with our defaults to ensure a gorgeous interface.
                            </p>
                        </div>
                    ) : (
                        <div className="slide-content fade-in">
                            <h1 className="brand-title-small">
                            Design with total brand confidence
                            </h1>
                            
                            <div className="info-item">
                                <div className="icon-badge-small">📏</div>
                                <div className="text-content">
                                    <p className="info-text-bold">Define your guidelines</p>
                                    <p className="info-text-small">Upload a PDF kit or simply describe your brand's vibe to our AI.</p>
                                </div>
                            </div>

                            <div className="info-item">
                                <div className="icon-badge-small">🎨</div>
                                <div className="text-content">
                                    <p className="info-text-bold">Live Linting Assistant</p>
                                    <p className="info-text-small">Real-time feedback as you design, just like Grammarly for your layers.</p>
                                    </div>
                            </div>

                            <div className="info-item">
                                <div className="icon-badge-small">🔗</div>
                                <div className="text-content">
                                    <p className="info-text-bold">One-Click Correction</p>
                                    <p className="info-text-small">Instantly fix off-brand colors, fonts, and spacing with one click.</p>
                                    </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Footer Actions */}
                <div className="footer-actions">
                    <button className="btn-green-next" onClick={handleNext}>
                        {step === 1 ? "Next →" : "Get Started →"}
                    </button>
                    
                    <div className="login-prompt">
                        Already have an account? 
                        <div className="login-link-container">
                            <span className="login-link" onClick={onLoginClick}>
                                Log in
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;