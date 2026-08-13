<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'

let startupPromise: Promise<void> | null = null

function loadStartupData() {
  if (startupPromise) return startupPromise

  startupPromise = (async () => {
    const auth = useAuthStore()
    const isValid = await auth.ensureValidSession()
    if (isValid) await useDictionaryStore().load(auth.token)
  })()
    .catch((error) => {
      console.warn('startup data loading failed', error)
    })
    .finally(() => {
      startupPromise = null
    })

  return startupPromise
}

onLaunch(() => {
  void loadStartupData()
})

onShow(() => {
  void loadStartupData()
})
</script>

<style lang="scss">
:root,
page {
  --tms-primary: #4f46e5;
  --tms-primary-deep: #312e81;
  --tms-primary-bright: #2563eb;
  --tms-primary-gradient: linear-gradient(135deg, #4338ca 0%, #4f46e5 48%, #2563eb 100%);
  --tms-hero-gradient: linear-gradient(142deg, #211d59 0%, #4338ca 48%, #2563eb 112%);
  --tms-bg: #f2f5fa;
  --tms-panel: #f7f9fc;
  --tms-surface: #ffffff;
  --tms-text: #152033;
  --tms-muted: #66738a;
  --tms-light: #98a3b5;
  --tms-line: #e4e9f1;
  --tms-green: #0f9f6e;
  --tms-orange: #ea8a14;
  --tms-red: #e5484d;
  --tms-blue-soft: #eef2ff;
  --tms-radius-sm: 14rpx;
  --tms-radius-md: 18rpx;
  --tms-radius-lg: 26rpx;
  --tms-radius-xl: 32rpx;
  --tms-control-height: 88rpx;
  --tms-control-radius: 18rpx;
  --tms-control-font-size: 28rpx;
  --tms-shadow-sm: 0 10rpx 30rpx rgba(28, 39, 65, 0.065);
  --tms-shadow-md: 0 20rpx 54rpx rgba(31, 40, 74, 0.12);
  --tms-shadow-primary: 0 14rpx 28rpx rgba(79, 70, 229, 0.23);
}

page {
  min-height: 100%;
  background: #f2f5fa;
  color: #152033;
  font-family:
    'HarmonyOS Sans', 'HarmonyOS Sans SC', 'PingFang SC', MiSans, 'Noto Sans SC', -apple-system, BlinkMacSystemFont,
    'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-weight: 400;
  font-synthesis: none;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

page::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  content: '';
  pointer-events: none;
  background:
    radial-gradient(circle at 6% 0, rgba(79, 70, 229, 0.055), transparent 440rpx),
    radial-gradient(circle at 96% 36%, rgba(37, 99, 235, 0.035), transparent 420rpx);
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
  touch-action: manipulation;
}

button {
  font-family: inherit;
}

button:focus-visible,
[role='button']:focus-visible {
  outline: 4rpx solid rgba(79, 70, 229, 0.32);
  outline-offset: 4rpx;
}

input,
textarea {
  caret-color: #4f46e5;
}
</style>
