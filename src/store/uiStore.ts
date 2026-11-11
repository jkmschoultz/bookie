import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SortMode } from '@/shelf/grouping';
import type { LayoutMode } from '@/shelf/layout';
import type { BookDraft, ReadStatus } from '@/types';

interface UiState {
  sortMode: SortMode;
  layoutMode: LayoutMode;
  /** Empty = show everything. */
  statusFilter: ReadStatus[];
  /** null = both; true = only books on your shelf; false = only books you don't own. */
  ownedFilter: boolean | null;
  /** Metadata handed from search/scan to the book form. */
  draft: BookDraft | null;
  setSortMode: (mode: SortMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleStatus: (status: ReadStatus) => void;
  setOwnedFilter: (owned: boolean | null) => void;
  /** Show everything again: no status filter and no ownership filter. */
  clearFilters: () => void;
  setDraft: (draft: BookDraft | null) => void;
  /** Back to first-launch defaults. */
  reset: () => void;
}

const DEFAULTS = {
  sortMode: 'genre',
  layoutMode: 'row',
  statusFilter: [],
  ownedFilter: null,
  draft: null,
} satisfies Pick<UiState, 'sortMode' | 'layoutMode' | 'statusFilter' | 'ownedFilter' | 'draft'>;

export const useUi = create<UiState>()(
  // Only the shelf layout is a lasting preference (set in Settings); the rest starts fresh each launch.
  persist(
    (set) => ({
      ...DEFAULTS,
      setSortMode: (sortMode) => set({ sortMode }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      toggleStatus: (status) =>
        set((s) => ({
          statusFilter: s.statusFilter.includes(status) ? s.statusFilter.filter((x) => x !== status) : [...s.statusFilter, status],
        })),
      setOwnedFilter: (ownedFilter) => set({ ownedFilter }),
      clearFilters: () => set({ statusFilter: [], ownedFilter: null }),
      setDraft: (draft) => set({ draft }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'ui', storage: createJSONStorage(() => Storage), partialize: (s) => ({ layoutMode: s.layoutMode }) },
  ),
);
