import { create } from 'zustand';

interface SupportModalState {
    isOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
    setOpen: (open: boolean) => void;
}

export const useSupportModalStore = create<SupportModalState>((set) => ({
    isOpen: false,
    openModal: () => set({ isOpen: true }),
    closeModal: () => set({ isOpen: false }),
    setOpen: (open: boolean) => set({ isOpen: open }),
}));
