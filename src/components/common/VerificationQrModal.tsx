import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCode } from 'antd';
import {
    QrCode,
    X,
    ExternalLink,
    Copy,
    BookOpen,
    Smartphone,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { openVerificationGuide, openExternalUrl } from '../../utils/guideOpener';
import { copyToClipboard } from '../../utils/clipboard';
import { showToast } from './ToastContainer';

interface QrModalDetail {
    email: string;
    url: string;
}

export const VerificationQrModal: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [modalData, setModalData] = useState<QrModalDetail | null>(null);

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const customEvent = e as CustomEvent<QrModalDetail>;
            if (customEvent.detail?.url) {
                setModalData(customEvent.detail);
                setIsOpen(true);
            }
        };

        window.addEventListener('open-verification-qr', handleOpen);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('open-verification-qr', handleOpen);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (!isOpen || !modalData) return null;

    const handleCopy = () => {
        copyToClipboard(modalData.url);
        showToast(t('accounts.validation_url_copied', 'Verification link copied to clipboard'), 'success');
    };

    const handleSwitchToMethod2 = () => {
        setIsOpen(false);
        openVerificationGuide();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Container */}
            <div className="relative flex flex-col bg-white dark:bg-[#12141a] border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl overflow-hidden z-10 w-full max-w-md transition-all duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/30">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                                    {t('accounts.verification_method_1_title', 'Method 1: Scan with Phone (QR Code)')}
                                </h3>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {modalData.email}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                        title={t('common.close', 'Close (ESC)')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col items-center gap-4">
                    {/* QR Code Container */}
                    <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        <QRCode
                            value={modalData.url}
                            size={200}
                            bordered={false}
                        />
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-center space-y-1.5 w-full">
                        <div className="flex items-center justify-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold text-xs">
                            <Smartphone className="w-4 h-4" />
                            <span>{t('accounts.scan_with_phone_tooltip', 'Scan with another phone')}</span>
                        </div>
                        <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90 leading-relaxed font-medium">
                            {t('accounts.scan_with_phone_hint', 'Scan this QR code with the camera on another mobile phone to verify. Using mobile data (4G/5G) avoids desktop IP blocks.')}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                        <button
                            type="button"
                            onClick={() => openExternalUrl(modalData.url)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{t('accounts.verify_in_browser_btn', 'Verify in Browser')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl transition-all border border-gray-200 dark:border-gray-700 active:scale-95 cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t('accounts.copy_validation_url', 'Copy Link')}</span>
                        </button>
                    </div>

                    {/* Divider & Method 2 fallback button */}
                    <div className="w-full pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                            {t('common.or', 'OR')}
                        </span>
                        <button
                            type="button"
                            onClick={handleSwitchToMethod2}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-500/30 transition-all active:scale-95 cursor-pointer"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{t('accounts.verification_method_2_title', 'Method 2: Google Cloud Shell SMS Verification Guide')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerificationQrModal;
