import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        set({ theme: nextTheme });
      },
      initTheme: () => {
        const theme = get().theme;
        document.documentElement.setAttribute('data-theme', theme);
      }
    }),
    {
      name: 'aro-theme-storage',
    }
  )
);
