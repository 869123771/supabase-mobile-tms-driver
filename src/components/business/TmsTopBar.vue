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
  min-height: 176rpx;
  padding: calc(34rpx + env(safe-area-inset-top)) 30rpx 28rpx;
  color: #fff;
  background: linear-gradient(135deg, #292266 0%, #4f46e5 56%, #2563eb 118%);
  display: grid;
  grid-template-columns: 64rpx 1fr 64rpx;
  align-items: center;
  gap: 18rpx;
}

.top-bar__copy {
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
  width: 64rpx;
  height: 64rpx;
}

.top-bar__icon {
  padding: 0;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
