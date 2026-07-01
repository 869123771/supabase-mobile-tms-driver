<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
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
      <wd-icon name="arrow-left" size="44rpx" />
    </button>
    <view v-else class="top-bar__spacer" />
    <text class="top-bar__title">{{ title }}</text>
    <button v-if="showMenu" class="top-bar__icon" hover-class="none">
      <wd-icon name="menu" size="42rpx" />
    </button>
    <view v-else class="top-bar__spacer" />
  </view>
</template>

<style scoped lang="scss">
.top-bar {
  height: 168rpx;
  padding: calc(32rpx + env(safe-area-inset-top)) 34rpx 28rpx;
  color: #fff;
  background: var(--tms-primary);
  display: grid;
  grid-template-columns: 64rpx 1fr 64rpx;
  align-items: end;
  gap: 18rpx;
}

.top-bar__title {
  min-width: 0;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.1;
}

.top-bar__icon,
.top-bar__spacer {
  width: 64rpx;
  height: 64rpx;
}

.top-bar__icon {
  padding: 0;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
