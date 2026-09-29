import { create } from 'zustand';

import type { SortMode } from '@/shelf/grouping';
import type { LayoutMode } from '@/shelf/layout';
import type { BookDraft, ReadStatus } from '@/types';

interface UiState {
  sortMode: SortMode;
  layoutMode: LayoutMode;
  /** Empty = show everything. */
  statusFilter: ReadStatus[];
  /** Metadata handed from search/scan to the book form. */
  draft: BookDraft | null;
  setSortMode: (mode: SortMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleStatus: (status: ReadStatus) => void;
  clearStatusFilter: () => void;
  setDraft: (draft: BookDraft | null) => void;
}

export const useUi = create<UiState>((set) => ({
  sortMode: 'genre',
  layoutMode: 'row',
  statusFilter: [],
  draft: null,
  setSortMode: (sortMode) => set({ sortMode }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  toggleStatus: (status) =>
    set((s) => ({
      statusFilter: s.statusFilter.includes(status) ? s.statusFilter.filter((x) => x !== status) : [...s.statusFilter, status],
    })),
  clearStatusFilter: () => set({ statusFilter: [] }),
  setDraft: (draft) => set({ draft }),
}));
