/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Memory Management & Working Set Optimization Store
 */
import { create } from 'zustand';
import { request } from '../utils/request';
import { AntigravityMemorySummary, AntigravityMemoryPurgeResult } from '../types/memory';
import { showToast } from '../components/common/ToastContainer';

interface MemoryStoreState {
  summary: AntigravityMemorySummary | null;
  isLoading: boolean;
  isPurging: boolean;
  lastPurgeResult: AntigravityMemoryPurgeResult | null;
  fetchSummary: () => Promise<void>;
  purgeMemory: () => Promise<AntigravityMemoryPurgeResult | null>;
}

export const useMemoryStore = create<MemoryStoreState>((set) => ({
  summary: null,
  isLoading: false,
  isPurging: false,
  lastPurgeResult: null,

  fetchSummary: async () => {
    try {
      set({ isLoading: true });
      const res = await request<AntigravityMemorySummary>('get_antigravity_memory_summary');
      set({ summary: res, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch Antigravity memory summary:', err);
      set({ isLoading: false });
    }
  },

  purgeMemory: async () => {
    try {
      set({ isPurging: true });
      const res = await request<AntigravityMemoryPurgeResult>('purge_antigravity_memory');
      set({ lastPurgeResult: res, isPurging: false });
      
      // Refresh summary
      try {
        const updatedSummary = await request<AntigravityMemorySummary>('get_antigravity_memory_summary');
        set({ summary: updatedSummary });
      } catch {}

      if (res && res.memory_freed_mb > 0) {
        const freedFormatted = res.memory_freed_mb >= 1024
          ? `${(res.memory_freed_mb / 1024).toFixed(1)} GB`
          : `${res.memory_freed_mb.toFixed(0)} MB`;
        showToast(
          `بهینه‌سازی رم انجام شد: ${freedFormatted} حافظه از ${res.total_processes_trimmed} پروسه آزاد گردید.`,
          'success'
        );
      } else {
        showToast('حافظه در بهینه‌ترین وضعیت ممکن قرار دارد.', 'info');
      }
      return res;
    } catch (err: any) {
      console.error('Failed to purge Antigravity memory:', err);
      set({ isPurging: false });
      showToast(String(err?.message || err), 'error');
      return null;
    }
  },
}));
