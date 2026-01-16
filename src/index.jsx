import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";

import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(() => {
    console.log("addOnUISdk is ready for use.");

    const rootElement = document.getElementById("root");
    if (!rootElement) {
        console.error("Root element not found!");
        return;
    }

    try {
        const root = createRoot(rootElement);
        root.render(<App addOnUISdk={addOnUISdk} />);
    } catch (error) {
        console.error("Error rendering app:", error);
        rootElement.innerHTML = `
            <div style="padding: 20px; color: #cc0000;">
                <h3>Error Loading Add-on</h3>
                <p>${error.message || 'Unknown error occurred'}</p>
                <p>Please check the console for more details.</p>
            </div>
        `;
    }
}).catch((error) => {
    console.error("Error initializing addOnUISdk:", error);
    const rootElement = document.getElementById("root");
    if (rootElement) {
        rootElement.innerHTML = `
            <div style="padding: 20px; color: #cc0000;">
                <h3>Error Initializing Adobe Express SDK</h3>
                <p>${error.message || 'Failed to load SDK'}</p>
                <p>Please refresh the page and try again.</p>
            </div>
        `;
    }
});
