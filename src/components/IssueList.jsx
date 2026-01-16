import React from "react";

const IssueList = ({ issues }) => {
    return (
        <div className="suggestion-feed-list">
            {issues.map((issue, index) => (
                <div key={index} className="suggestion-card fade-in">
                    <div className="suggestion-header">
                        {/* Dynamic dot color based on issue type */}
                        <div className={`indicator-dot ${issue.type.toLowerCase().includes('font') ? 'font-dot' : 'color-dot'}`}></div>
                        <span className="suggestion-type">{issue.type}</span>
                    </div>
                    
                    <p className="suggestion-body">
                        {issue.message}
                    </p>

                    <div className="suggestion-footer">
                        <button 
                            className="single-fix-link" 
                            onClick={() => console.log("Applying fix for:", issue.type)}
                        >
                            Accept
                        </button>
                        <button 
                            className="dismiss-link" 
                            onClick={() => console.log("Dismissing suggestion")}
                        >
                            Ignore
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default IssueList;