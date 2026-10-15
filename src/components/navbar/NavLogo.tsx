import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useState } from 'react';
import { NavVersionBadge } from './NavVersionBadge';

export function NavLogo() {
    const [imgFailed, setImgFailed] = useState(false);

    return (
        <Link 
            to="/" 
            draggable="false" 
            className="flex items-center gap-2.5 group select-none transition-all duration-200 cursor-pointer"
        >
            <div className="relative flex items-center justify-center">
                {/* Neon Glow Aura */}
                <div 
                    className="absolute -inset-1 rounded-xl blur-sm group-hover:blur-md transition-all duration-300 opacity-80 group-hover:opacity-100" 
                    style={{ background: 'linear-gradient(90deg, rgba(var(--color-accent-rgb), 0.4), rgba(var(--color-accent-rgb), 0.2))' }}
                />
                
                {/* Logo Container */}
                <div 
                    className="relative w-9 h-9 rounded-xl bg-slate-900/90 p-1 flex items-center justify-center shadow-lg transition-colors"
                    style={{
                        borderColor: 'var(--color-badge-border)',
                        boxShadow: '0 4px 14px -2px var(--color-accent-glow)',
                    }}
                >
                    {!imgFailed ? (
                        <img
                            src="/icon.png"
                            alt="Antigravity Shield"
                            className="w-full h-full object-contain rounded-lg active:scale-95 transition-transform"
                            draggable="false"
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <Shield className="w-5 h-5 animate-pulse" style={{ color: 'var(--color-accent)' }} />
                    )}
                </div>
            </div>

            <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                    <span 
                        className="text-base font-extrabold tracking-tight bg-clip-text text-transparent"
                        style={{
                            backgroundImage: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
                        }}
                    >
                        Antigravity
                    </span>
                    <span className="text-base font-extrabold tracking-tight text-white dark:text-slate-100">
                        Shield
                    </span>
                    <span 
                        className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-badge-bg)',
                            color: 'var(--color-badge-text)',
                            border: '1px solid var(--color-badge-border)',
                            boxShadow: '0 0 8px var(--color-accent-glow)',
                        }}
                    >
                        PRO
                    </span>
                    <NavVersionBadge />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-400 tracking-wider font-medium hidden xl:flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-ping inline-block" style={{ backgroundColor: 'var(--color-accent)' }} />
                    AI Gateway Shield
                </span>
            </div>
        </Link>
    );
}


