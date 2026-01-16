import React, { useState } from "react";
import { Button } from "@swc-react/button";
import { Textfield } from "@swc-react/textfield";

const Auth = ({ onAuthSuccess, onBack }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ email: "", password: "", brandName: "" });

    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would typically integrate your backend/API
        console.log(`${isLogin ? "Logging in" : "Signing up"} with:`, formData);
        onAuthSuccess(); 
    };

    return (
        <div className="welcome-container">
            <div className="welcome-box elongated fade-in">
                <div className="nav-header">
                    <button className="nav-arrow" onClick={onBack}>←</button>
                </div>

                <div className="content-wrapper">
                    <h1 className="brand-title" style={{ textAlign: 'left', marginBottom: '8px' }}>
                        {isLogin ? "Welcome back" : "Create account"}
                    </h1>
                    <p className="brand-subtitle" style={{ textAlign: 'left', marginBottom: '24px' }}>
                        {isLogin ? "Enter your details to sync your brand." : "Start keeping your designs consistent today."}
                    </p>

                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div style={{ marginBottom: '16px' }}>
                                <label className="input-label">Brand Name</label>
                                <Textfield 
                                    placeholder="e.g. Acme Corp" 
                                    style={{ width: '100%' }}
                                    onInput={(e) => setFormData({...formData, brandName: e.target.value})}
                                />
                            </div>
                        )}
                        
                        <div style={{ marginBottom: '16px' }}>
                            <label className="input-label">Email</label>
                            <Textfield 
                                type="email" 
                                placeholder="name@company.com" 
                                style={{ width: '100%' }}
                                onInput={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="input-label">Password</label>
                            <Textfield 
                                type="password" 
                                placeholder="••••••••" 
                                style={{ width: '100%' }}
                                onInput={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </div>

                        <button type="submit" className="btn-green-next">
                            {isLogin ? "Log in →" : "Sign up →"}
                        </button>
                    </form>
                </div>

                <div className="login-prompt">
                    {isLogin ? "New to BrandLint?" : "Already have an account?"}
                    <div className="login-link-container">
                        <span className="login-link" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? "Create an account" : "Log in instead"}
                        </span>
                    </div>
                </div>   
            </div>
        </div>
    );
};

export default Auth;