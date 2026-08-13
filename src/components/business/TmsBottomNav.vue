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

function go(item: (typeof items)[number]) {
  if (item.key === props.active) return
  uni.reLaunch({ url: item.url })
}
</script>

<template>
  <view class="bottom-nav">
    <view
      v-for="item in items"
      :key="item.key"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': item.key === props.active }"
      @tap="go(item)"
    >
      <view v-if="item.key === props.active" class="bottom-nav__active-pill" />
      <view class="bottom-nav__icon-box">
        <TmsIcon :name="item.icon" size="42rpx" :active="item.key === props.active" />
      </view>
      <text>{{ item.label }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 18rpx;
  right: 18rpx;
  bottom: calc(14rpx + env(safe-area-inset-bottom));
  z-index: 20;
  height: 122rpx;
  padding: 10rpx 18rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.91);
  border: 1rpx solid rgba(224, 230, 240, 0.9);
  border-radius: 32rpx;
  backdrop-filter: blur(28rpx) saturate(150%);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  box-shadow: 0 20rpx 54rpx rgba(29, 39, 66, 0.17), 0 2rpx 0 rgba(255, 255, 255, 0.9) inset;
}

.bottom-nav__item {
  position: relative;
  min-width: 0;
  color: #929daf;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.1;
}

.bottom-nav__item--active {
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
  height: 56rpx;
  border-radius: 18rpx;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.bottom-nav__item--active .bottom-nav__icon-box {
  background: transparent;
}


.bottom-nav__item text {
  position: relative;
  z-index: 1;
}
</style>
