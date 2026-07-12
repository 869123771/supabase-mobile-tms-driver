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
  background: var(--tms-bg);
  color: var(--tms-text);
  font-family:
    'PingFang SC', 'HarmonyOS Sans SC', MiSans, 'Noto Sans SC', -apple-system, BlinkMacSystemFont,
    'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-weight: 400;
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
</style>
