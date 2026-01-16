import React from 'react';
import './SkeletonLoader.css';

/**
 * Skeleton loader component for loading states
 * Spectrum-style loading placeholders
 */
export const SkeletonLoader = ({ lines = 3, className = '' }) => {
    return (
        <div className={`skeleton-container ${className}`}>
            {Array.from({ length: lines }).map((_, index) => (
                <div 
                    key={index} 
                    className={`skeleton-line ${index === lines - 1 ? 'skeleton-line-short' : ''}`}
                />
            ))}
        </div>
    );
};

/**
 * Skeleton loader for violation items
 */
export const ViolationSkeleton = () => {
    return (
        <div className="violation-skeleton">
            <div className="skeleton-icon" />
            <div className="skeleton-content">
                <div className="skeleton-line skeleton-line-medium" />
                <div className="skeleton-line skeleton-line-full" />
                <div className="skeleton-line skeleton-line-short" />
            </div>
        </div>
    );
};
