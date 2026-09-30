import { defineStore } from 'pinia'

export const THEME_PRESETS = [
  { id: 'indigo', name: '经典靛蓝', description: '沉稳清晰', mapColor: '#4f46e5' },
  { id: 'ocean', name: '海洋蓝', description: '明快可靠', mapColor: '#155eef' },
  { id: 'forest', name: '青松绿', description: '平和专注', mapColor: '#0f766e' }
] as const

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id']

const STORAGE_KEY = 'tms-driver-theme'

function isThemePresetId(value: unknown): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value)
}

function savedPreset(): ThemePresetId {
  try {
    const value: unknown = uni.getStorageSync(STORAGE_KEY)
    return isThemePresetId(value) ? value : 'indigo'
  } catch {
    return 'indigo'
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ preset: savedPreset() }),
  getters: {
    // Native map polylines require a hex color and cannot consume CSS variables.
    mapColor: (state) => THEME_PRESETS.find((preset) => preset.id === state.preset)?.mapColor || THEME_PRESETS[0].mapColor
  },
  actions: {
    selectPreset(preset: ThemePresetId): boolean {
      if (this.preset === preset) return true
      this.preset = preset
      try {
        uni.setStorageSync(STORAGE_KEY, preset)
        return true
      } catch {
        return false
      }
    }
  }
})
