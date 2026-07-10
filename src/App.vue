<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'

onLaunch(() => {
  const auth = useAuthStore()
  auth.hydrate()
  if (auth.isLoggedIn) {
    void useDictionaryStore().load(auth.token)
  }
})

onShow(() => {
  const auth = useAuthStore()
  if (auth.isTokenExpired) {
    void auth.refreshSession()
  } else if (auth.isLoggedIn) {
    void useDictionaryStore().load(auth.token)
  }
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
