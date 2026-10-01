/**
 * Settings Store (Zustand).
 * Manages user preferences: PPA tariff rate, currency, theme, and optional LLM assistant toggle.
 * Persists to localStorage.
 */

import { create } from 'zustand'

const SETTINGS_KEY = 'solarpower_settings'

function loadSettings() {
  const defaults = {
    tariff: 6.5, // Assumed institutional electricity tariff (INR 6.50/kWh)
    currency: 'INR',
    theme: 'paper', // 'paper' or 'console' (dark)
    llmEnabled: false,
  }

  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (err) {
    console.warn('[useSettingsStore] Failed loading settings:', err)
    return defaults
  }
}

function saveSettings(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        tariff: state.tariff,
        currency: state.currency,
        theme: state.theme,
        llmEnabled: state.llmEnabled,
      })
    )
  } catch (err) {
    console.warn('[useSettingsStore] Failed saving settings:', err)
  }
}

export const useSettingsStore = create((set, get) => ({
  ...loadSettings(),

  setTariff: (tariff) => {
    const rate = Math.max(0.1, Number(tariff) || 3.15)
    set({ tariff: rate })
    saveSettings(get())
  },

  setCurrency: (currency) => {
    set({ currency })
    saveSettings(get())
  },

  setTheme: (theme) => {
    set({ theme })
    saveSettings(get())
    if (typeof document !== 'undefined') {
      if (theme === 'console') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'paper' ? 'console' : 'paper'
    get().setTheme(nextTheme)
  },

  setLlmEnabled: (llmEnabled) => {
    set({ llmEnabled: Boolean(llmEnabled) })
    saveSettings(get())
  },
}))
