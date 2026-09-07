import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useState } from 'react';

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
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/40 via-sky-500/30 to-emerald-500/40 rounded-xl blur-sm group-hover:blur-md transition-all duration-300 opacity-80 group-hover:opacity-100" />
                
                {/* Logo Container */}
                <div className="relative w-9 h-9 rounded-xl bg-slate-900/90 border border-cyan-500/40 p-1 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:border-cyan-400 transition-colors">
                    {!imgFailed ? (
                        <img
                            src="/icon.png"
                            alt="Antigravity Shield"
                            className="w-full h-full object-contain rounded-lg active:scale-95 transition-transform"
                            draggable="false"
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <Shield className="w-5 h-5 text-cyan-400 animate-pulse" />
                    )}
                </div>
            </div>

            <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                    <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
                        Antigravity
                    </span>
                    <span className="text-base font-extrabold tracking-tight text-white dark:text-slate-100">
                        Shield
                    </span>
                    <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                        PRO
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-400 tracking-wider font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    AI Gateway Shield
                </span>
            </div>
        </Link>
    );
}
