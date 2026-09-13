import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/env';

export interface ToolkitConnectionStatus {
  is_connected: boolean;
  active_ide: string | null;
  extension_version: string | null;
  active_email: string | null;
  seconds_since_last_ping: number | null;
}

export interface IdeInfo {
  id: string;
  name: string;
  category: 'code_oss' | 'jetbrains' | 'standalone';
  is_installed: boolean;
  executable_path: string | null;
  version: string | null;
  toolkit_installed: boolean;
  supports_auto_install: boolean;
  official_extension_url: string | null;
  guide_url: string | null;
}

interface ToolkitState {
  status: ToolkitConnectionStatus;
  ides: IdeInfo[];
  isLoadingStatus: boolean;
  isLoadingIdes: boolean;
  installingIdes: Record<string, boolean>;
  isModalOpen: boolean;

  fetchStatus: () => Promise<void>;
  fetchIdes: () => Promise<void>;
  installToIde: (ideId: string) => Promise<{ success: boolean; message: string }>;
  openModal: () => void;
  closeModal: () => void;
}

export const useToolkitStore = create<ToolkitState>((set, get) => ({
  status: {
    is_connected: false,
    active_ide: null,
    extension_version: null,
    active_email: null,
    seconds_since_last_ping: null,
  },
  ides: [],
  isLoadingStatus: false,
  isLoadingIdes: false,
  installingIdes: {},
  isModalOpen: false,

  fetchStatus: async () => {
    if (!isTauri()) {
      try {
        const res = await fetch('http://127.0.0.1:8765/toolkit/status');
        if (res.ok) {
          const data = await res.json();
          set({ status: data });
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const data = await invoke<ToolkitConnectionStatus>('get_toolkit_status');
      set({ status: data });
    } catch (err) {
      console.warn('[ToolkitStore] Failed to fetch status:', err);
    }
  },

  fetchIdes: async () => {
    set({ isLoadingIdes: true });
    if (!isTauri()) {
      try {
        const res = await fetch('http://127.0.0.1:8765/toolkit/ides');
        if (res.ok) {
          const data: IdeInfo[] = await res.json();
          set({ ides: data, isLoadingIdes: false });

          const agIde = data.find((i) => i.id === 'antigravity');
          if (agIde && agIde.is_installed && !agIde.toolkit_installed && !get().installingIdes['antigravity']) {
            get().installToIde('antigravity');
          }
          return;
        }
      } catch {
        // fallback
      }
      set({ isLoadingIdes: false });
      return;
    }

    try {
      const data = await invoke<IdeInfo[]>('detect_installed_ides');
      set({ ides: data, isLoadingIdes: false });

      const agIde = data.find((i) => i.id === 'antigravity');
      if (agIde && agIde.is_installed && !agIde.toolkit_installed && !get().installingIdes['antigravity']) {
        get().installToIde('antigravity');
      }
    } catch (err) {
      console.warn('[ToolkitStore] Failed to detect IDEs:', err);
      set({ isLoadingIdes: false });
    }
  },

  installToIde: async (ideId: string) => {
    set((state) => ({
      installingIdes: { ...state.installingIdes, [ideId]: true },
    }));

    try {
      let msg = '';
      if (!isTauri()) {
        const res = await fetch('http://127.0.0.1:8765/toolkit/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ide_id: ideId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Installation failed');
        msg = data.message || 'Installed successfully';
      } else {
        msg = await invoke<string>('install_toolkit_to_ide', { ideId });
      }

      // Re-scan IDEs to refresh installed flag
      await get().fetchIdes();

      set((state) => ({
        installingIdes: { ...state.installingIdes, [ideId]: false },
      }));
      return { success: true, message: msg };
    } catch (err: any) {
      set((state) => ({
        installingIdes: { ...state.installingIdes, [ideId]: false },
      }));
      return { success: false, message: err.message || String(err) };
    }
  },

  openModal: () => {
    set({ isModalOpen: true });
    get().fetchIdes();
    get().fetchStatus();
  },

  closeModal: () => set({ isModalOpen: false }),
}));
