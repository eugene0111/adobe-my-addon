import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
// Note: Ensure the file name case matches your project (e.g., ./MainLinterUI)
import MainLinterUI from "./MainLinterUi"; 
import Welcome from "./Welcome";
import { addOnUISdk } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import { Provider, Content, lightTheme } from "@adobe/react-spectrum";
import Auth from "./Auth";
import "./App.css";
import { documentExtractor } from "../utils/documentExtractor";

const App = ({ addOnUISdk }) => {
  const [user, setUser] = useState(null);
    // view can be: "welcome", "auth", or "linter"
    const [view, setView] = useState("welcome"); 
    const [issues, setIssues] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedElements, setExtractedElements] = useState([]);

    /**
     * Communicates with the Document Sandbox to scan for violations.
     */
    const scanDocument = async () => {
        setIsScanning(true);
        try {
            // For now, just call testExtractElements
            // TODO: Replace with actual scan logic when backend is ready
            await testExtractElements();
        } catch (error) {
            console.error("Scan failed:", error);
        }
        setIsScanning(false);
    };

    /**
     * Test function to extract and display all elements from canvas
     */
    const testExtractElements = async () => {
        try {
            console.clear();
            console.log("═══════════════════════════════════════");
            console.log("[TEST] Extracting elements from canvas...");
            console.log("═══════════════════════════════════════");
            
            const { runtime } = addOnUISdk.instance;
            const sandboxProxy = await runtime.apiProxy("documentSandbox");
            
            const documentData = await sandboxProxy.extractDocumentData();
            
            console.log("[TEST] ✅ Extraction complete!");
            console.log("[TEST] Document data:", documentData);
            console.log(`[TEST] Found ${documentData.elements?.length || 0} elements`);
            console.log("═══════════════════════════════════════");
            
            if (documentData.elements && documentData.elements.length > 0) {
                console.log("[TEST] ELEMENTS DETAILS:");
                documentData.elements.forEach((element, index) => {
                    console.log(`\n[TEST] Element ${index + 1}:`, {
                        id: element.id || element.guid || 'NO_ID',
                        type: element.type || 'unknown',
                        text: element.textStyle?.text || element.text || 'N/A',
                        fontFamily: element.textStyle?.fontFamily || 'N/A',
                        fontSize: element.textStyle?.fontSize || 'N/A',
                        color: element.textStyle?.color || 'N/A',
                        fill: element.fill || 'N/A',
                        hasTextStyle: !!element.textStyle
                    });
                });
                
                setExtractedElements(documentData.elements);
                console.log("\n[TEST] ✅ Elements stored in state. Check UI below.");
            } else {
                console.warn("[TEST] ⚠️ No elements found!");
                console.warn("[TEST] Make sure:");
                console.warn("  1. You have text/shapes on the canvas");
                console.warn("  2. Elements are not locked");
                console.warn("  3. Document is fully loaded");
                setExtractedElements([]);
            }
            
            console.log("═══════════════════════════════════════");
            
        } catch (error) {
            console.error("[TEST] ❌ Extraction failed:", error);
            console.error("[TEST] Error details:", error.message, error.stack);
            setExtractedElements([]);
        }
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
                        onTestExtract={testExtractElements}
                        extractedElements={extractedElements}
                    />
                )}
            </div>
        </Theme>
    );
};

export default App;