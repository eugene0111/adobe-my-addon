import React from "react";
import { Button } from "@swc-react/button";

const ActionPanel = ({ onScan, onFix, isScanning, hasIssues }) => (
    <div className="actions" style={{ margin: "16px 0" }}>
        <Button size="m" onClick={onScan} disabled={isScanning}>
            {isScanning ? "Scanning..." : "Scan Document"}
        </Button>
        
        {hasIssues && (
            <Button size="m" variant="accent" onClick={onFix} style={{ marginLeft: "8px" }}>
                Fix All
            </Button>
        )}
    </div>
);

export default ActionPanel;