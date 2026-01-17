import React, { useState, useEffect } from "react";
import { Theme } from "@swc-react/theme";
import MainLinterUI from "./MainLinterUi";
import Welcome from "./Welcome";
import Auth from "./Auth";
import { MOCK_BRAND_PROFILE } from "../utils/mockData.js";
import "./App.css";
import { sendExtractedElements } from "../services/api.js";

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
      console.error("[App] Scan failed with error:", error);
      console.error("[App] Error stack:", error.stack);
      setIssues([
        {
          type: "error",
          message: `Scan failed: ${error.message}`,
          severity: "error",
        },
      ]);
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
      console.log(
        `[TEST] Found ${documentData.elements?.length || 0} elements`
      );
      console.log("═══════════════════════════════════════");

      if (documentData.elements && documentData.elements.length > 0) {
        console.log("[TEST] ELEMENTS DETAILS:");
        documentData.elements.forEach((element, index) => {
          console.log(`\n[TEST] Element ${index + 1}:`, {
            id: element.id || element.guid || "NO_ID",
            type: element.type || "unknown",
            text: element.textStyle?.text || element.text || "N/A",
            fontFamily: element.textStyle?.fontFamily || "N/A",
            fontSize: element.textStyle?.fontSize || "N/A",
            color: element.textStyle?.color || "N/A",
            fill: element.fill || "N/A",
            hasTextStyle: !!element.textStyle,
          });
        });

        setExtractedElements(documentData.elements);
        // Optionally send to backend right after extraction
        try {
          const resp = await sendExtractedElements(documentData.elements);
          console.log("[TEST] 📤 Sent elements to backend:", resp);
        } catch (sendErr) {
          console.warn(
            "[TEST] ⚠️ Failed to send elements to backend:",
            sendErr
          );
        }
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
  /**
   * Sends a command to the sandbox to fix detected issues.
   * Refactored to plan fixes in the UI thread (network) and execute in Sandbox (document).
   */
  const fixAllIssues = async () => {
    try {
      console.log("[App] Planning fixes...");

      // 1. Plan fixes (call backend from UI thread)
      // Import dynamically or ensure planFixes is imported at top
      const { planFixes, executeFixes } = await import("../services/api.js");
      const brandProfile = MOCK_BRAND_PROFILE;
      const planResponse = await planFixes(
        issues,
        brandProfile || MOCK_BRAND_PROFILE,
        { fixAllSimilar: true }
      );

      if (
        !planResponse.success ||
        !planResponse.fix_plan ||
        !planResponse.fix_plan.actions
      ) {
        console.error("[App] Fix planning failed:", planResponse);
        setIssues((prev) => [
          { ...prev[0], message: "Failed to generate fix plan" },
        ]); // Simple user feedback
        return;
      }

      const actions = planResponse.fix_plan.actions;
      console.log(
        `[App] Planned ${actions.length} fix actions. Executing in sandbox...`
      );

      // 2. Execute fixes in Sandbox (document access)
      const { runtime } = addOnUISdk.instance;
      const sandboxProxy = await runtime.apiProxy("documentSandbox");

      const result = await sandboxProxy.executeBulkFixes(actions);

      // 3. Log/Verify execution with backend
      try {
        await executeFixes(actions);
      } catch (e) {
        console.warn("[App] Failed to log fixes to backend:", e);
      }

      console.log("[App] Execution result:", result);

      // 4. Re-scan to update UI
      await scanDocument();
    } catch (error) {
      console.error("[App] Fixing failed:", error);
      setIssues((prev) => [
        {
          type: "error",
          message: `Fix failed: ${error.message}`,
          severity: "error",
        },
        ...prev,
      ]);
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
            onTestExtract={testExtractElements}
            extractedElements={extractedElements}
            addOnUISdk={addOnUISdk}
          />
        )}
      </div>
    </Theme>
  );
};

export default App;
