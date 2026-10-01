import { create } from 'zustand'

/**
 * App-level store.
 * Keeps selected plant, active diagnosis, and UI preferences.
 */
export const useAppStore = create((set) => ({
  plantId: 'bhadla-block-c',
  diagId: null,
  darkMode: false,

  setPlantId: (id) => set({ plantId: id }),
  setDiagId: (id) => set({ diagId: id }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}))

