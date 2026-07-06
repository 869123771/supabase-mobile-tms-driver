<script setup lang="ts">
import { computed } from 'vue'
import type { Waybill } from '@/api/types'
import { formatDateTime, formatDuration, formatTon } from '@/utils/format'
import TmsIcon from './TmsIcon.vue'
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

const cargoNo = computed(
  () => props.waybill.cargoNo || props.waybill.goodsNo || props.waybill.orderNo || '--'
)
const originStation = computed(() => props.waybill.fromStationName || props.waybill.originCity)
const destinationStation = computed(() => props.waybill.toStationName || props.waybill.destinationCity)
const pickupAddress = computed(
  () => props.waybill.senderAddress || props.waybill.shipperAddress || originStation.value || '--'
)
const deliveryAddress = computed(
  () => props.waybill.receiverAddress || destinationStation.value || '--'
)

function open() {
  if (props.clickable) emit('open', props.waybill)
}
</script>

<template>
  <view class="route-card card" @tap="open">
    <view class="route-card__head">
      <view class="route-card__route">
        <text>{{ props.waybill.originCity || '--' }}</text>
        <TmsIcon name="arrow-right" size="34rpx" />
        <text>{{ props.waybill.destinationCity || '--' }}</text>
      </view>
      <TmsStatusTag v-if="props.showStatus" :status="props.waybill.status" />
    </view>

    <view class="route-card__no-row">
      <text>运单号：{{ props.waybill.waybillNo }}</text>
      <text v-if="cargoNo !== '--'">货号：{{ cargoNo }}</text>
    </view>

    <view class="route-card__points">
      <view class="route-card__point">
        <view class="route-card__dot route-card__dot--start">
          <TmsIcon name="location" size="22rpx" color="#fff" />
        </view>
        <view class="route-card__point-main">
          <text class="route-card__address">{{ pickupAddress }}</text>
          <text v-if="props.waybill.plannedLoadTime" class="route-card__time">
            装货：{{ formatDateTime(props.waybill.plannedLoadTime) }}
          </text>
        </view>
      </view>
      <view class="route-card__point">
        <view class="route-card__dot route-card__dot--end">
          <TmsIcon name="flag" size="22rpx" color="#fff" />
        </view>
        <view class="route-card__point-main">
          <text class="route-card__address">{{ deliveryAddress }}</text>
          <text v-if="props.waybill.plannedUnloadTime" class="route-card__time">
            卸货：{{ formatDateTime(props.waybill.plannedUnloadTime) }}
          </text>
        </view>
      </view>
      <button class="route-card__nav" hover-class="none" @tap.stop="emit('navigate', props.waybill)">
        <view class="route-card__nav-icon">
          <TmsIcon name="nav" size="28rpx" />
        </view>
        <text>导航</text>
      </button>
    </view>

    <view class="route-card__meta">
      <view class="route-card__meta-item">
        <TmsIcon name="location" size="28rpx" />
        <text>{{ originStation }}</text>
      </view>
      <view class="route-card__meta-item">
        <TmsIcon name="time" size="28rpx" />
        <text>预计{{ formatDuration(props.waybill.estimatedDurationMin) }}</text>
      </view>
      <view class="route-card__meta-item">
        <TmsIcon name="box" size="28rpx" />
        <text>{{ formatTon(props.waybill.cargoWeightTon) }}</text>
      </view>
    </view>

    <TmsProgress v-if="props.showProgress" :status="props.waybill.status" />
    <slot />
  </view>
</template>

<style scoped lang="scss">
.route-card {
  padding: 26rpx;
  border-radius: 12rpx;
}

.route-card__head {
  min-height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.route-card__route {
  min-width: 0;
  color: var(--tms-text);
  display: flex;
  align-items: center;
  gap: 14rpx;
  font-size: 31rpx;
  font-weight: 800;
}

.route-card__route :deep(.tms-icon) {
  flex: 0 0 auto;
  color: var(--tms-primary);
}

.route-card__route text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.route-card__no-row {
  margin-top: 12rpx;
  color: var(--tms-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 22rpx;
  font-size: 24rpx;
  line-height: 1.35;
}

.route-card__points {
  position: relative;
  margin-top: 18rpx;
  padding: 18rpx 96rpx 18rpx 18rpx;
  border-radius: 10rpx;
  background: var(--tms-panel);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.route-card__points::before {
  content: '';
  position: absolute;
  left: 34rpx;
  top: 56rpx;
  bottom: 56rpx;
  border-left: 2rpx dashed #d8dfed;
}

.route-card__point {
  position: relative;
  z-index: 1;
  min-height: 42rpx;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.route-card__dot {
  flex: 0 0 34rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 21rpx;
  font-weight: 800;
}

.route-card__dot--start {
  background: var(--tms-primary);
}

.route-card__dot--end {
  background: #ff944d;
}

.route-card__point-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.route-card__address {
  color: #4b5566;
  font-size: 26rpx;
  line-height: 1.35;
}

.route-card__time {
  color: var(--tms-muted);
  font-size: 23rpx;
  line-height: 1.3;
}

.route-card__nav {
  position: absolute;
  right: 18rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 64rpx;
  height: 72rpx;
  padding: 0;
  border-radius: 8rpx;
  color: var(--tms-muted);
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  font-size: 21rpx;
  line-height: 1;
  box-shadow: 0 6rpx 16rpx rgba(55, 99, 244, 0.08);
}

.route-card__nav-icon {
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.route-card__meta {
  margin: 18rpx 0 24rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.route-card__meta-item {
  min-width: 0;
  color: var(--tms-muted);
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 23rpx;
}

.route-card__meta-item text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
