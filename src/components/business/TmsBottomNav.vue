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
  height: 116rpx;
  padding: 10rpx 22rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid #e5e9f1;
  border-radius: 28rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  box-shadow: 0 18rpx 50rpx rgba(31, 40, 66, 0.16);
}

.bottom-nav__item {
  min-width: 0;
  color: #9aa5b7;
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
  font-weight: 700;
}

.bottom-nav__icon-box {
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
  background: #eef2ff;
}
</style>
