import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

export function usePageTheme() {
  const theme = useThemeStore()
  return {
    theme,
    themeName: computed(() => `tms-${theme.preset}`)
  }
}
