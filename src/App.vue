<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'

async function loadStartupData() {
  const auth = useAuthStore()
  const isValid = await auth.ensureValidSession()
  if (isValid) await useDictionaryStore().load(auth.token)
}

onLaunch(() => {
  void loadStartupData()
})

onShow(() => {
  void loadStartupData()
})
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: #f4f6fa;
  color: #172033;
  font-family:
    'PingFang SC', 'HarmonyOS Sans SC', MiSans, 'Noto Sans SC', -apple-system, BlinkMacSystemFont,
    'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

view,
text,
button,
input,
textarea {
  box-sizing: border-box;
}

button::after {
  border: 0;
}

button,
[role='button'] {
  -webkit-tap-highlight-color: transparent;
}
</style>
