<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(() => {
  useAuthStore().hydrate()
})

onShow(() => {
  const auth = useAuthStore()
  if (auth.isTokenExpired) {
    void auth.refreshSession()
  }
})
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: var(--tms-bg);
  color: var(--tms-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
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
