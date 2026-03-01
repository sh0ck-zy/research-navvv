import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GalaxyNode } from '../galaxy/schema';

export interface QueueItem {
  id: string;
  title: string;
  year?: number;
  category?: string;
  url?: string;
}

interface QueueState {
  items: QueueItem[];
  addNode: (node: GalaxyNode) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

function toQueueItem(node: GalaxyNode): QueueItem {
  return {
    id: node.id,
    title: node.title,
    year: node.year,
    category: node.category,
    url: node.url,
  };
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],
      addNode: (node) =>
        set((state) => {
          if (state.items.some((item) => item.id === node.id)) {
            return state;
          }

          return {
            items: [toQueueItem(node), ...state.items],
          };
        }),
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      has: (id) => get().items.some((item) => item.id === id),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'navvv-galaxy-queue',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
