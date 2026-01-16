import React from "react";

const IssueList = ({ issues, onFixIssue, onDismissIssue }) => {
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
                            onClick={() => onFixIssue && onFixIssue(issue)}
                        >
                            Accept
                        </button>
                        <button 
                            className="dismiss-link" 
                            onClick={() => onDismissIssue && onDismissIssue(issue, index)}
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