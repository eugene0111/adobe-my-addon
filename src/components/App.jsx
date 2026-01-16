import React, { useState, useEffect } from "react";
import { Theme } from "@swc-react/theme";
// Note: Ensure the file name case matches your project (e.g., ./MainLinterUI)
import MainLinterUI from "./MainLinterUi"; 
import Welcome from "./Welcome";
import Auth from "./Auth";
import { MOCK_BRAND_PROFILE } from "../utils/mockData.js";
import { validateDesign } from "../services/api.js";
import "./App.css";

const App = ({ addOnUISdk }) => {
    // view can be: "welcome", "auth", or "linter"
    const [view, setView] = useState("welcome"); 
    const [issues, setIssues] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [brandProfile, setBrandProfile] = useState(null);

    // Load brand profile from localStorage or use mock on mount
    useEffect(() => {
        const savedProfile = localStorage.getItem('brandProfile');
        if (savedProfile) {
            try {
                setBrandProfile(JSON.parse(savedProfile));
            } catch (e) {
                console.error("Error parsing saved brand profile:", e);
                setBrandProfile(MOCK_BRAND_PROFILE);
            }
        } else {
            setBrandProfile(MOCK_BRAND_PROFILE);
        }
    }, []);

    // Save brand profile to localStorage whenever it changes
    useEffect(() => {
        if (brandProfile) {
            localStorage.setItem('brandProfile', JSON.stringify(brandProfile));
        }
    }, [brandProfile]);

    /**
     * Communicates with the Document Sandbox to scan for violations.
     */
    const scanDocument = async () => {
        setIsScanning(true);
        try {
            console.log("[App] Starting document scan with brand profile:", brandProfile);
            
            // Step 1: Extract document data from sandbox
            const scanResult = await addOnUISdk.app.runtime.proxy.scanForBrandViolations(brandProfile);
            
            console.log("[App] Document extraction result:", scanResult);
            
            if (!scanResult || !scanResult.ready) {
                console.warn("[App] Document extraction failed:", scanResult?.error);
                setIssues([]);
                setIsScanning(false);
                return;
            }

            const { documentData, brandProfile: scanBrandProfile } = scanResult;
            
            // Step 2: Validate with backend API (UI has better network access)
            if (!documentData || !documentData.elements || documentData.elements.length === 0) {
                console.warn("[App] No elements to validate");
                setIssues([]);
                setIsScanning(false);
                return;
            }

            console.log("[App] Validating with backend API...");
            
            try {
                const response = await validateDesign(scanBrandProfile || brandProfile, documentData);
                
                console.log("[App] Backend validation response:", response);
                
                if (!response.success || !response.violations) {
                    console.error("[App] Validation failed:", response);
                    setIssues([]);
                    setIsScanning(false);
                    return;
                }

                // Transform violations to UI format
                const uiViolations = response.violations.map(violation => ({
                    type: violation.type || 'unknown',
                    message: violation.message || `${violation.type} violation detected`,
                    severity: violation.severity || 'warning',
                    element_id: violation.element_id,
                    expected: violation.expected,
                    found: violation.found
                }));

                console.log("[App] Found violations:", uiViolations.length);
                setIssues(uiViolations || []);
            } catch (apiError) {
                console.error("[App] API call failed:", apiError);
                console.error("[App] API error details:", {
                    message: apiError.message,
                    status: apiError.status,
                    data: apiError.data
                });
                
                // Show user-friendly error
                setIssues([{
                    type: 'error',
                    message: `Failed to connect to backend: ${apiError.message}. Make sure the backend server is running on http://localhost:3000`,
                    severity: 'error'
                }]);
            }
        } catch (error) {
            console.error("[App] Scan failed with error:", error);
            console.error("[App] Error stack:", error.stack);
            setIssues([{
                type: 'error',
                message: `Scan failed: ${error.message}`,
                severity: 'error'
            }]);
        }
        setIsScanning(false);
    };

    /**
     * Sends a command to the sandbox to fix detected issues.
     */
    const fixAllIssues = async () => {
        try {
            const result = await addOnUISdk.app.runtime.proxy.fixViolations(issues, brandProfile);
            if (result && result.success) {
                console.log(`Fixed ${result.fixed} issues, ${result.failed} failed`);
                // Re-scan to update issues list
                await scanDocument();
            } else {
                console.error("Fixing failed:", result?.error);
            }
        } catch (error) {
            console.error("Fixing failed:", error);
        }
    };

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                {/* 1. Welcome Screen View */}
                {view === "welcome" && (
                    <Welcome 
                        onStart={() => setView("linter")} 
                        onLoginClick={() => setView("auth")} 
                    />
                )}

                {/* 2. Authentication View (Login/Signup) */}
                {view === "auth" && (
                    <Auth 
                        onAuthSuccess={() => setView("linter")} 
                        onBack={() => setView("welcome")} 
                    />
                )}

                {/* 3. Main Dashboard View (MainLinterUI) */}
                {view === "linter" && (
                    <MainLinterUI 
                        issues={issues}
                        setIssues={setIssues}
                        isScanning={isScanning} 
                        onScan={scanDocument} 
                        onFix={fixAllIssues} 
                        setView={setView}
                        brandProfile={brandProfile}
                        setBrandProfile={setBrandProfile}
                    />
                )}
            </div>
        </Theme>
    );
};

export default App;