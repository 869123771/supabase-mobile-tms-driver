<script setup lang="ts">
import TmsIcon from './TmsIcon.vue'

type NavKey = 'home' | 'waybill' | 'vehicle' | 'mine'

const props = defineProps<{
  active: NavKey
}>()

const items: Array<{ key: NavKey; label: string; icon: 'home' | 'waybill' | 'vehicle' | 'user'; url: string }> = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/home/index' },
  { key: 'waybill', label: '运单', icon: 'waybill', url: '/pages/waybill/index' },
  { key: 'vehicle', label: '车辆', icon: 'vehicle', url: '/pages/vehicle/index' },
  { key: 'mine', label: '我的', icon: 'user', url: '/pages/mine/index' }
]

function go(value: string | number) {
  const item = items.find((entry) => entry.key === value)
  if (!item) return
  if (item.key === props.active) return
  uni.reLaunch({ url: item.url })
}
</script>

<template>
  <view class="bottom-nav">
    <wd-tabbar
      :model-value="props.active"
      custom-class="bottom-nav__bar"
      active-color="#4f46e5"
      inactive-color="#929daf"
      @change="go($event.value)"
    >
      <wd-tabbar-item
        v-for="item in items"
        :key="item.key"
        :name="item.key"
        custom-class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': item.key === props.active }"
        :aria-label="item.label"
        :aria-current="item.key === props.active ? 'page' : undefined"
        role="tab"
        :aria-selected="item.key === props.active"
        tabindex="0"
      >
        <view v-if="item.key === props.active" class="bottom-nav__active-pill" />
        <view class="bottom-nav__icon-box">
          <TmsIcon :name="item.icon" :size="item.key === 'vehicle' ? '50rpx' : '42rpx'" :active="item.key === props.active" />
        </view>
        <text>{{ item.label }}</text>
      </wd-tabbar-item>
    </wd-tabbar>
  </view>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 18rpx;
  right: 18rpx;
  bottom: calc(14rpx + env(safe-area-inset-bottom));
  z-index: 20;
  height: 132rpx;
  padding: 12rpx 18rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid rgba(224, 230, 240, 0.9);
  border-radius: 32rpx;
  backdrop-filter: blur(28rpx) saturate(150%);
  display: block;
  box-shadow: 0 16rpx 42rpx rgba(29, 39, 66, 0.13), 0 2rpx 0 rgba(255, 255, 255, 0.9) inset;
}

:deep(.bottom-nav__bar) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: transparent;
}

:deep(.bottom-nav__item) {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 22rpx;
  background: transparent;
  min-width: 0;
  color: #929daf;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.1;
}

:deep(.bottom-nav__item)::after {
  border: 0;
}

:deep(.bottom-nav__item--pressed) {
  background: rgba(79, 70, 229, 0.06);
}

:deep(.bottom-nav__item--active) {
  color: #4f46e5;
  font-weight: 800;
}

.bottom-nav__active-pill {
  position: absolute;
  top: 3rpx;
  width: 74rpx;
  height: 60rpx;
  border-radius: 20rpx;
  background: linear-gradient(180deg, #eef2ff, #e8edff);
}

.bottom-nav__icon-box {
  position: relative;
  z-index: 1;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

:deep(.bottom-nav__item--active) .bottom-nav__icon-box {
  background: transparent;
}


:deep(.bottom-nav__item) text {
  position: relative;
  z-index: 1;
}

:deep(.bottom-nav__item):focus-visible {
  outline: 4rpx solid rgba(79, 70, 229, 0.36);
  outline-offset: -4rpx;
}
</style>
