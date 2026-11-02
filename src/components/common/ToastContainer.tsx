/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Toast, { ToastType, ToastAction } from './Toast';

export interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    action?: ToastAction;
}

let toastCounter = 0;
let addToastExternal: ((message: string, type: ToastType, duration?: number, action?: ToastAction) => void) | null = null;

export const showToast = (message: string, type: ToastType = 'info', duration: number = 3000, action?: ToastAction) => {
    if (addToastExternal) {
        addToastExternal(message, type, duration, action);
    } else {
        console.warn('ToastContainer not mounted');
    }
};

const ToastContainer = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType, duration?: number, action?: ToastAction) => {
        const id = `toast-${Date.now()}-${toastCounter++}`;
        setToasts(prev => {
            // Prevent duplicate message stacking
            if (prev.some(t => t.message === message)) {
                return prev;
            }
            // Limit visible toasts to maximum 3 to prevent screen flooding
            const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
            return [...trimmed, { id, message, type, duration, action }];
        });
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        addToastExternal = addToast;
        return () => {
            addToastExternal = null;
        };
    }, [addToast]);

    return createPortal(
        <div className="fixed top-24 end-8 z-[200] flex flex-col gap-3 pointer-events-none">
            <div className="flex flex-col gap-3 pointer-events-auto">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
};

export default ToastContainer;
