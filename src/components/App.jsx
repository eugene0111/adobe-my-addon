import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
// Note: Ensure the file name case matches your project (e.g., ./MainLinterUI)
import MainLinterUI from "./MainLinterUi"; 
import Welcome from "./Welcome";
import Auth from "./Auth";
import "./App.css";

const App = ({ addOnUISdk }) => {
    // view can be: "welcome", "auth", or "linter"
    const [view, setView] = useState("welcome"); 
    const [issues, setIssues] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    /**
     * Communicates with the Document Sandbox to scan for violations.
     */
    const scanDocument = async () => {
        setIsScanning(true);
        try {
            // Invokes the sandbox scan logic
            const results = await addOnUISdk.app.runtime.proxy.scanForBrandViolations();
            setIssues(results);
        } catch (error) {
            console.error("Scan failed:", error);
        }
        setIsScanning(false);
    };

    /**
     * Sends a command to the sandbox to fix detected issues.
     */
    const fixAllIssues = async () => {
        try {
            await addOnUISdk.app.runtime.proxy.fixViolations(issues);
            setIssues([]); 
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
                        isScanning={isScanning} 
                        onScan={scanDocument} 
                        onFix={fixAllIssues} 
                        setView={setView} 
                    />
                )}
            </div>
        </Theme>
    );
};

export default App;