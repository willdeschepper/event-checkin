import { create } from 'zustand';

import type { QueueSummary } from './model';

type QueueState = QueueSummary & {
  isSyncing: boolean;
  isOnline: boolean;
  setSummary: (summary: QueueSummary) => void;
  setSyncing: (isSyncing: boolean) => void;
  setOnline: (isOnline: boolean) => void;
};

export const useQueueStore = create<QueueState>(set => ({
  pending: 0,
  confirmed: 0,
  failed: 0,
  isSyncing: false,
  isOnline: true,
  setSummary: summary => set(summary),
  setSyncing: isSyncing => set({ isSyncing }),
  setOnline: isOnline => set({ isOnline }),
}));
