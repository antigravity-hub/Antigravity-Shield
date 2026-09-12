import { useState, useEffect } from 'react';
import { Heart, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSupportModalStore } from '../../stores/useSupportModalStore';
import { copyToClipboard } from '../../utils/clipboard';
import { showToast } from './ToastContainer';

export function SupportModal() {
    const { t } = useTranslation();
    const { isOpen, closeModal } = useSupportModalStore();
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeModal]);

    const handleCopyAddress = (addr: string) => {
        copyToClipboard(addr);
        setCopiedAddress(addr);
        showToast(t('settings.about.support_copied', 'Address copied!'), 'success');
        setTimeout(() => {
            setCopiedAddress((curr) => (curr === addr ? null : curr));
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open z-[100]">
            <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-[110]" />
            <div className="modal-box relative max-w-xl bg-white dark:bg-base-100 shadow-2xl rounded-3xl p-0 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center p-6 sm:p-8">
                    <div className="w-16 h-16 bg-pink-50 dark:bg-pink-900/20 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                        <Heart className="w-8 h-8 text-pink-500 fill-pink-500" />
                    </div>

                    <h3 className="text-2xl font-black text-gray-900 dark:text-base-content mb-2 text-center">
                        {t('settings.about.support_title')}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6 max-w-md leading-relaxed">
                        {t('settings.about.support_desc')}
                    </p>

                    {/* QR Codes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full mb-6">
                        {/* GRAM (TON) */}
                        <div className="flex flex-col items-center p-4 rounded-2xl bg-gray-50 dark:bg-base-200 border border-gray-100 dark:border-base-300 shadow-sm transition-all hover:border-blue-300 dark:hover:border-blue-700">
                            <div className="w-full max-w-[190px] aspect-square relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 p-2">
                                <img src="/images/donate/gram.png" alt="GRAM (TON)" className="w-full h-full object-contain" />
                            </div>
                            <div className="mt-3 text-center w-full">
                                <div className="text-sm font-black text-gray-800 dark:text-gray-100 mb-1">
                                    {t('settings.about.support_gram', 'GRAM (TON)')}
                                </div>
                                <div
                                    className="text-[11px] font-mono text-gray-600 dark:text-gray-300 truncate px-2 py-1.5 bg-white dark:bg-base-300 rounded-lg border border-gray-200 dark:border-base-100 mb-2 select-all cursor-pointer hover:bg-gray-100 dark:hover:bg-base-100 transition-colors"
                                    title="UQBvB6Vjd-IGZz7a6xc6gdOlDyEJGIfCtLxcYl4nAGboDJBN"
                                    onClick={() => handleCopyAddress('UQBvB6Vjd-IGZz7a6xc6gdOlDyEJGIfCtLxcYl4nAGboDJBN')}
                                >
                                    UQBvB6Vjd-IGZz7a6xc6gdOlDyEJGIfCtLxcYl4nAGboDJBN
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopyAddress('UQBvB6Vjd-IGZz7a6xc6gdOlDyEJGIfCtLxcYl4nAGboDJBN')}
                                    className="w-full py-1.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {copiedAddress === 'UQBvB6Vjd-IGZz7a6xc6gdOlDyEJGIfCtLxcYl4nAGboDJBN' ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-500 font-bold">{t('settings.about.support_copied', 'Copied')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('settings.about.support_copy_address', 'Copy Address')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tron (TRX) */}
                        <div className="flex flex-col items-center p-4 rounded-2xl bg-gray-50 dark:bg-base-200 border border-gray-100 dark:border-base-300 shadow-sm transition-all hover:border-red-300 dark:hover:border-red-700">
                            <div className="w-full max-w-[190px] aspect-square relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 p-2">
                                <img src="/images/donate/tron.png" alt="Tron" className="w-full h-full object-contain" />
                            </div>
                            <div className="mt-3 text-center w-full">
                                <div className="text-sm font-black text-gray-800 dark:text-gray-100 mb-1">
                                    {t('settings.about.support_tron', 'Tron (TRX / USDT)')}
                                </div>
                                <div
                                    className="text-[11px] font-mono text-gray-600 dark:text-gray-300 truncate px-2 py-1.5 bg-white dark:bg-base-300 rounded-lg border border-gray-200 dark:border-base-100 mb-2 select-all cursor-pointer hover:bg-gray-100 dark:hover:bg-base-100 transition-colors"
                                    title="TFH25GHwwdd87vmi3xMmr6KXYsnV8wVMSH"
                                    onClick={() => handleCopyAddress('TFH25GHwwdd87vmi3xMmr6KXYsnV8wVMSH')}
                                >
                                    TFH25GHwwdd87vmi3xMmr6KXYsnV8wVMSH
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopyAddress('TFH25GHwwdd87vmi3xMmr6KXYsnV8wVMSH')}
                                    className="w-full py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {copiedAddress === 'TFH25GHwwdd87vmi3xMmr6KXYsnV8wVMSH' ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-500 font-bold">{t('settings.about.support_copied', 'Copied')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('settings.about.support_copy_address', 'Copy Address')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeModal}
                        className="w-full sm:w-auto px-12 py-3 bg-gray-100 dark:bg-base-300 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-base-200 transition-all cursor-pointer"
                    >
                        {t('common.close') || 'Close'}
                    </button>
                </div>
            </div>
            <div className="modal-backdrop bg-black/60 backdrop-blur-md fixed inset-0 z-[-1]" onClick={closeModal} />
        </div>
    );
}

export default SupportModal;
