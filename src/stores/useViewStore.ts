/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { create } from 'zustand';

interface ViewState {
    isMiniView: boolean;
    setMiniView: (isMini: boolean) => void;
    toggleMiniView: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
    isMiniView: false,
    setMiniView: (isMini) => set({ isMiniView: isMini }),
    toggleMiniView: () => set((state) => ({ isMiniView: !state.isMiniView })),
}));
