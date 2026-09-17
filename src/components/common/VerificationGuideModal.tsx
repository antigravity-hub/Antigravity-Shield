import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen,
    X,
    ExternalLink,
    Download,
    Maximize2,
    Minimize2,
    CheckCircle2,
    Terminal,
    ArrowRight
} from 'lucide-react';
import { openVerificationGuideInSystem, downloadVerificationGuide, openExternalUrl } from '../../utils/guideOpener';

export const VerificationGuideModal: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isOpeningSystem, setIsOpeningSystem] = useState<boolean>(false);

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-verification-guide', handleOpen);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('open-verification-guide', handleOpen);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOpenInSystem = async () => {
        setIsOpeningSystem(true);
        try {
            await openVerificationGuideInSystem();
        } finally {
            setTimeout(() => setIsOpeningSystem(false), 1000);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
            {/* Backdrop with modern glassmorphism */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Container */}
            <div
                className={`relative flex flex-col bg-white dark:bg-[#12141a] border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl overflow-hidden z-10 transition-all duration-300 ${
                    isFullscreen
                        ? 'w-full h-full m-0 rounded-none'
                        : 'w-full max-w-6xl h-[92vh]'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-gray-800/80">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0 shadow-sm border border-amber-500/30">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                                    {t('accounts.verification_guide.card_title', 'Google Verification Loop Fix (Cloud Shell Bypass)')}
                                </h3>
                                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    {t('accounts.verification_guide.card_badge', 'Proven Solution')}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                                {t('accounts.verification_guide.card_desc', 'Google blocks Antigravity OAuth with "Further action is required to use Antigravity IDE" because the account requires SMS verification in Cloud Shell.')}
                            </p>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {/* Open in System PDF Reader */}
                        <button
                            type="button"
                            onClick={handleOpenInSystem}
                            disabled={isOpeningSystem}
                            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg transition-colors border border-amber-500/30 active:scale-95"
                            title={t('accounts.verification_guide.open_in_system_title', 'Open in system default PDF viewer (Adobe Acrobat / Edge)')}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">
                                {isOpeningSystem ? t('accounts.verification_guide.opening_in_system', 'Opening...') : t('accounts.verification_guide.open_in_system', 'Open in Default App')}
                            </span>
                        </button>

                        {/* Download PDF Button */}
                        <button
                            type="button"
                            onClick={downloadVerificationGuide}
                            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700/60 active:scale-95 flex items-center gap-1.5"
                            title={t('accounts.verification_guide.download_guide_title', 'Download guide PDF file')}
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{t('accounts.verification_guide.download_file', 'Download PDF')}</span>
                        </button>

                        {/* Toggle Fullscreen */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors active:scale-95"
                            title={isFullscreen ? t('accounts.verification_guide.exit_fullscreen', 'Exit Fullscreen') : t('accounts.verification_guide.fullscreen', 'Fullscreen')}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                            title={t('accounts.verification_guide.close', 'Close (ESC)')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Quick 7-Step Protocol Banner */}
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/30 px-4 py-2 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar text-amber-900 dark:text-amber-200">
                        <span className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                            <Terminal className="w-3.5 h-3.5" />
                            {t('accounts.verification_guide.steps_title', 'Quick Steps:')}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                            <span className="bg-amber-200/50 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200 font-bold">1</span>
                            <span>{t('accounts.verification_guide.step1', 'Sign in to GCP')}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 rtl:rotate-180" />
                            <span className="bg-amber-200/50 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200 font-bold">2</span>
                            <span>{t('accounts.verification_guide.step2', 'Launch Cloud Shell')}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 rtl:rotate-180" />
                            <span className="bg-amber-200/50 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200 font-bold">3</span>
                            <span>{t('accounts.verification_guide.step3', 'Verify Phone & SMS')}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 rtl:rotate-180" />
                            <span className="bg-emerald-200/70 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('accounts.verification_guide.step4', 'Back to Antigravity')}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => openExternalUrl('https://console.cloud.google.com/welcome')}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-[11px] transition-all shadow-sm active:scale-95 whitespace-nowrap self-start md:self-auto"
                    >
                        <ExternalLink className="w-3 h-3" />
                        {t('accounts.verification_guide.open_gcp', 'Open Google Cloud Console')}
                    </button>
                </div>

                {/* PDF Viewer Body */}
                <div className="relative flex-1 w-full h-full bg-gray-100 dark:bg-[#0c0d12] overflow-hidden">
                    <iframe
                        src="/guides/Antigravity_Verification_Guide.pdf#view=FitH&toolbar=1"
                        className="w-full h-full border-0"
                        title="Antigravity Verification Guide PDF"
                    />
                </div>
            </div>
        </div>
    );
};

export default VerificationGuideModal;
