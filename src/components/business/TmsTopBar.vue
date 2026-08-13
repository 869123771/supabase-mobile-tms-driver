<script setup lang="ts">
import TmsIcon from './TmsIcon.vue'

withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    showBack?: boolean
    showMenu?: boolean
  }>(),
  {
    showBack: false,
    showMenu: true
  }
)

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="top-bar">
    <view class="top-bar__glow" />
    <button v-if="showBack" class="top-bar__icon" hover-class="none" @tap="back">
      <TmsIcon name="back" size="38rpx" />
    </button>
    <view v-else class="top-bar__spacer" />
    <view class="top-bar__copy">
      <text v-if="eyebrow" class="top-bar__eyebrow">{{ eyebrow }}</text>
      <text class="top-bar__title">{{ title }}</text>
      <text v-if="subtitle" class="top-bar__subtitle">{{ subtitle }}</text>
    </view>
    <button v-if="showMenu" class="top-bar__icon" hover-class="none">
      <TmsIcon name="menu" size="38rpx" />
    </button>
    <view v-else class="top-bar__spacer" />
  </view>
</template>

<style scoped lang="scss">
.top-bar {
  position: relative;
  min-height: 176rpx;
  padding: calc(34rpx + env(safe-area-inset-top)) 30rpx 28rpx;
  color: #fff;
  overflow: hidden;
  background: var(--tms-hero-gradient);
  display: grid;
  grid-template-columns: 64rpx 1fr 64rpx;
  align-items: center;
  gap: 18rpx;
}

.top-bar::after {
  position: absolute;
  right: -110rpx;
  top: -170rpx;
  width: 390rpx;
  height: 390rpx;
  content: '';
  border: 1rpx solid rgba(255, 255, 255, 0.11);
  border-radius: 50%;
  box-shadow: 0 0 0 58rpx rgba(255, 255, 255, 0.025);
}

.top-bar__glow {
  position: absolute;
  left: 48%;
  bottom: -170rpx;
  width: 420rpx;
  height: 260rpx;
  border-radius: 50%;
  background: rgba(82, 146, 255, 0.2);
  filter: blur(72rpx);
  pointer-events: none;
}

.top-bar__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.top-bar__eyebrow {
  margin-bottom: 4rpx;
  font-size: 20rpx;
  font-weight: 600;
  opacity: 0.76;
}

.top-bar__title {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.25;
}

.top-bar__subtitle {
  max-width: 100%;
  margin-top: 5rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20rpx;
  font-weight: 600;
  opacity: 0.7;
}

.top-bar__icon,
.top-bar__spacer {
  position: relative;
  z-index: 1;
  width: 64rpx;
  height: 64rpx;
}

.top-bar__icon {
  padding: 0;
  color: #fff;
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(16rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
