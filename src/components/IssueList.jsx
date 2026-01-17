import React from "react";

const IssueList = ({ issues, onFixIssue, onDismissIssue, onSelectElement }) => {
    const handleIssueClick = (issue) => {
        // When clicking on the issue card, try to select the element
        if (issue.element_id && onSelectElement) {
            onSelectElement(issue.element_id);
        }
    };

    return (
        <div className="suggestion-feed-list">
            {issues.map((issue, index) => (
                <div 
                    key={index} 
                    className="suggestion-card fade-in"
                    // onClick={() => handleIssueClick(issue)}
                    // style={{ cursor: issue.element_id ? 'pointer' : 'default' }}
                    // title={issue.element_id ? "Click to select element on canvas" : ""}
                >
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