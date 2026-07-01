<script setup lang="ts">
import type { Waybill } from '@/api/types'
import { formatDateTime, formatDuration, formatTon } from '@/utils/format'
import TmsProgress from './TmsProgress.vue'
import TmsStatusTag from './TmsStatusTag.vue'

const props = withDefaults(
  defineProps<{
    waybill: Waybill
    showProgress?: boolean
    showStatus?: boolean
    clickable?: boolean
  }>(),
  {
    showProgress: false,
    showStatus: true,
    clickable: true
  }
)

const emit = defineEmits<{
  open: [waybill: Waybill]
  navigate: [waybill: Waybill]
}>()

function open() {
  if (props.clickable) emit('open', props.waybill)
}
</script>

<template>
  <view class="route-card card" @tap="open">
    <view class="route-card__head">
      <view class="route-card__cities">
        <text>{{ props.waybill.originCity }}</text>
        <text class="route-card__arrow">→</text>
        <text>{{ props.waybill.destinationCity }}</text>
      </view>
      <TmsStatusTag v-if="props.showStatus" :status="props.waybill.status" />
    </view>

    <view class="route-card__no">运单号： {{ props.waybill.waybillNo }}</view>

    <view class="route-card__points">
      <view class="route-card__point">
        <text class="route-card__dot route-card__dot--start">起</text>
        <view class="route-card__point-text">
          <text>{{ props.waybill.shipperAddress }}</text>
          <text v-if="props.waybill.plannedLoadTime" class="route-card__time">
            装货：{{ formatDateTime(props.waybill.plannedLoadTime) }}
          </text>
        </view>
      </view>
      <view class="route-card__line" />
      <view class="route-card__point">
        <text class="route-card__dot route-card__dot--end">终</text>
        <view class="route-card__point-text">
          <text>{{ props.waybill.receiverAddress }}</text>
          <text v-if="props.waybill.plannedUnloadTime" class="route-card__time">
            卸货：{{ formatDateTime(props.waybill.plannedUnloadTime) }}
          </text>
        </view>
      </view>
      <button class="route-card__nav" hover-class="none" @tap.stop="emit('navigate', props.waybill)">
        <wd-icon name="navigation" size="42rpx" />
        <text>导航</text>
      </button>
    </view>

    <view class="route-card__meta">
      <view class="route-card__meta-item">
        <wd-icon name="location" size="32rpx" />
        <text>{{ props.waybill.originCity }}临平网点</text>
      </view>
      <view class="route-card__meta-item">
        <wd-icon name="time" size="32rpx" />
        <text>预计{{ formatDuration(props.waybill.estimatedDurationMin) }}</text>
      </view>
      <view class="route-card__meta-item">
        <wd-icon name="goods" size="32rpx" />
        <text>{{ formatTon(props.waybill.cargoWeightTon) }}</text>
      </view>
    </view>

    <TmsProgress v-if="props.showProgress" :status="props.waybill.status" />
    <slot />
  </view>
</template>

<style scoped lang="scss">
.route-card {
  padding: 30rpx;
}

.route-card__head {
  min-height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.route-card__cities {
  min-width: 0;
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.route-card__arrow {
  color: var(--tms-primary);
  font-size: 42rpx;
  line-height: 1;
}

.route-card__no {
  margin-top: 14rpx;
  color: var(--tms-muted);
  font-size: 26rpx;
}

.route-card__points {
  position: relative;
  margin-top: 24rpx;
  padding: 22rpx 108rpx 22rpx 22rpx;
  border-radius: 12rpx;
  background: var(--tms-panel);
}

.route-card__point {
  min-height: 48rpx;
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.route-card__line {
  width: 0;
  height: 34rpx;
  margin-left: 17rpx;
  border-left: 2rpx dashed #d7ddea;
}

.route-card__dot {
  flex: 0 0 36rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
}

.route-card__dot--start {
  background: var(--tms-green);
}

.route-card__dot--end {
  background: var(--tms-orange);
}

.route-card__point-text {
  min-width: 0;
  color: #3c4250;
  font-size: 27rpx;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.route-card__time {
  color: var(--tms-muted);
}

.route-card__nav {
  position: absolute;
  right: 26rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 70rpx;
  height: 86rpx;
  padding: 0;
  color: var(--tms-primary);
  background: transparent;
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  font-size: 22rpx;
  line-height: 1;
}

.route-card__meta {
  margin: 22rpx 0 26rpx;
  display: grid;
  grid-template-columns: 1.4fr 1.15fr 0.8fr;
  gap: 14rpx;
}

.route-card__meta-item {
  min-width: 0;
  color: var(--tms-muted);
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.route-card__meta-item text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
