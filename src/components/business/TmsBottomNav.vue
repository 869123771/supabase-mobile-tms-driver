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
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  height: calc(132rpx + env(safe-area-inset-bottom));
  padding: 14rpx 42rpx calc(14rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  box-shadow: 0 -8rpx 24rpx rgba(40, 45, 54, 0.04);
}

.bottom-nav__item {
  color: #a9b0bd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  font-size: 22rpx;
  line-height: 1.1;
}

.bottom-nav__item--active {
  color: var(--tms-primary);
  font-weight: 700;
}

.bottom-nav__icon-box {
  width: 46rpx;
  height: 46rpx;
  border-radius: 12rpx;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>
