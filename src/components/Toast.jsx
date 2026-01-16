import React, { useEffect } from 'react';
import './Toast.css';

/**
 * Toast notification component
 * Displays temporary messages to the user
 * Supports undo action for fix operations
 */
export const Toast = ({ message, type = 'info', onClose, duration = 3000, onUndo, showUndo = false }) => {
  useEffect(() => {
    if (duration > 0 && !showUndo) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose, showUndo]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        <div className="toast-actions">
          {showUndo && onUndo && (
            <button className="toast-undo" onClick={onUndo} aria-label="Undo">
              Undo
            </button>
          )}
          <button className="toast-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Toast container component
 * Manages multiple toast notifications
 */
export const ToastContainer = ({ toasts, removeToast, onUndo }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
          onUndo={toast.onUndo ? () => {
            if (toast.onUndo) toast.onUndo();
            removeToast(toast.id);
          } : undefined}
          showUndo={!!toast.onUndo}
        />
      ))}
    </div>
  );
};
