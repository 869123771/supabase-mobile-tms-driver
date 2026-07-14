<script setup lang="ts">
import { computed } from 'vue'
import type { Waybill } from '@/api/types'
import { formatDateTime, formatDuration, formatKm, formatTon } from '@/utils/format'
import { getEstimatedDurationMin, getRouteDistanceKm } from '@/utils/route'
import TmsIcon from './TmsIcon.vue'
import TmsProgress from './TmsProgress.vue'
import TmsStatusTag from './TmsStatusTag.vue'

const props = withDefaults(
  defineProps<{
    waybill: Waybill
    showProgress?: boolean
    showStatus?: boolean
    clickable?: boolean
    variant?: 'default' | 'task' | 'compact' | 'list'
    title?: string
  }>(),
  {
    showProgress: false,
    showStatus: true,
    clickable: true,
    variant: 'default',
    title: ''
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
const displayDistanceKm = computed(() => getRouteDistanceKm(props.waybill))
const displayDurationMin = computed(() => getEstimatedDurationMin(props.waybill))
const groupStatus = computed(() => {
  const status = props.waybill.status
  if (status === 'pending') return { label: '待处理', tone: 'orange' }
  if (status === 'signed') return { label: '待签收', tone: 'orange' }
  if (status === 'completed') return { label: '已完成', tone: 'green' }
  if (status === 'cancelled') return { label: '已取消', tone: 'red' }
  return { label: '进行中', tone: 'blue' }
})

function open() {
  if (props.clickable) emit('open', props.waybill)
}
</script>

<template>
  <view class="route-card card" :class="`route-card--${props.variant}`" @tap="open">
    <view v-if="props.variant === 'compact'" class="route-card__compact">
      <view class="route-card__compact-top">
        <view class="route-card__compact-main">
          <view class="route-card__route route-card__route--compact">
            <text>{{ props.waybill.originCity || '--' }}</text>
            <TmsIcon name="route-arrow" size="44rpx" />
            <text>{{ props.waybill.destinationCity || '--' }}</text>
          </view>

          <view class="route-card__no-row route-card__no-row--compact">
            <text>运单号：{{ props.waybill.waybillNo }}</text>
          </view>
        </view>
        <view class="route-card__compact-side">
          <TmsStatusTag v-if="props.showStatus" :status="props.waybill.status" />
        </view>
      </view>

      <view class="route-card__meta route-card__meta--compact">
        <view class="route-card__meta-item">
          <TmsIcon name="location" size="26rpx" />
          <text>{{ originStation }}</text>
        </view>
        <view class="route-card__meta-item route-card__meta-item--center">
          <TmsIcon name="time" size="26rpx" />
          <text>预计{{ formatDuration(displayDurationMin) }}</text>
        </view>
        <view class="route-card__meta-item route-card__meta-item--right">
          <TmsIcon name="box" size="26rpx" />
          <text>{{ formatTon(props.waybill.cargoWeightTon) }}</text>
        </view>
      </view>
    </view>

    <template v-else>
      <view v-if="props.variant === 'task'" class="route-card__section-head">
        <text class="route-card__section-title">{{ props.title || '当前任务' }}</text>
        <TmsStatusTag v-if="props.showStatus" :status="props.waybill.status" />
      </view>

      <view class="route-card__head">
        <view class="route-card__route">
          <text>{{ props.waybill.originCity || '--' }}</text>
          <TmsIcon name="route-arrow" size="44rpx" />
          <text>{{ props.waybill.destinationCity || '--' }}</text>
        </view>
        <TmsStatusTag
          v-if="props.showStatus && props.variant !== 'task' && props.variant !== 'list'"
          :status="props.waybill.status"
        />
        <view
          v-if="props.showStatus && props.variant === 'list'"
          class="route-card__group-status"
          :class="`route-card__group-status--${groupStatus.tone}`"
        >
          {{ groupStatus.label }}
        </view>
      </view>

      <view v-if="props.variant !== 'task'" class="route-card__no-row">
        <text>运单号：{{ props.waybill.waybillNo }}</text>
        <text v-if="cargoNo !== '--'">货号：{{ cargoNo }}</text>
      </view>

      <view class="route-card__points">
        <view class="route-card__point">
          <view class="route-card__dot route-card__dot--start">
            <text v-if="props.variant === 'list'">起</text>
            <TmsIcon v-else name="location" size="22rpx" color="#fff" />
          </view>
          <view class="route-card__point-main">
            <text class="route-card__address">{{ pickupAddress }}</text>
            <text
              v-if="props.waybill.plannedLoadTime && props.variant !== 'list'"
              class="route-card__time"
            >
              装货：{{ formatDateTime(props.waybill.plannedLoadTime) }}
            </text>
          </view>
        </view>
        <view class="route-card__point">
          <view class="route-card__dot route-card__dot--end">
            <text v-if="props.variant === 'list'">终</text>
            <TmsIcon v-else name="flag" size="22rpx" color="#fff" />
          </view>
          <view class="route-card__point-main">
            <text class="route-card__address">{{ deliveryAddress }}</text>
            <text
              v-if="props.waybill.plannedUnloadTime && props.variant !== 'list'"
              class="route-card__time"
            >
              卸货：{{ formatDateTime(props.waybill.plannedUnloadTime) }}
            </text>
          </view>
        </view>
        <view
          v-if="props.variant !== 'list'"
          class="route-card__nav"
          @tap.stop
        >
          <wd-button
            class="route-card__nav-button"
            type="text"
            @click="emit('navigate', props.waybill)"
          >
            <view class="route-card__nav-icon">
              <TmsIcon name="nav" size="22rpx" />
            </view>
            <text class="route-card__nav-label">导航</text>
          </wd-button>
        </view>
      </view>

      <view v-if="props.variant === 'task'" class="route-card__meta route-card__meta--task">
        <view class="route-card__meta-item">
          <TmsIcon name="time" size="28rpx" />
          <text>预计{{ formatDuration(displayDurationMin) }}</text>
        </view>
        <view class="route-card__meta-item route-card__meta-item--right">
          <text>剩余距离：{{ formatKm(displayDistanceKm) }}</text>
        </view>
      </view>
      <view v-else class="route-card__meta">
        <view class="route-card__meta-item">
          <TmsIcon name="location" size="28rpx" />
          <text>{{ originStation }}</text>
        </view>
        <view class="route-card__meta-item route-card__meta-item--center">
          <TmsIcon name="time" size="28rpx" />
          <text>预计{{ formatDuration(displayDurationMin) }}</text>
        </view>
        <view class="route-card__meta-item route-card__meta-item--right">
          <TmsIcon name="box" size="28rpx" />
          <text>{{ formatTon(props.waybill.cargoWeightTon) }}</text>
        </view>
      </view>

      <TmsProgress v-if="props.showProgress" :status="props.waybill.status" />
    </template>
    <slot />
  </view>
</template>

<style scoped lang="scss">
.route-card {
  padding: 26rpx;
  border-radius: 12rpx;
}

.route-card--task {
  padding: 30rpx;
  border-radius: 16rpx;
}

.route-card--compact {
  padding: 22rpx 0 18rpx;
  border-radius: 0;
  background: transparent;
}

.route-card--list {
  padding: 28rpx 28rpx 24rpx;
  border-radius: 10rpx;
}

.route-card__section-head {
  margin-bottom: 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.route-card__section-title {
  color: var(--tms-text);
  font-size: 31rpx;
  font-weight: 700;
  line-height: 1.25;
}

.route-card__head {
  min-height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.route-card__group-status {
  flex: 0 0 auto;
  height: 44rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1;
}

.route-card__group-status--blue {
  color: var(--tms-primary);
  background: #edf2ff;
}

.route-card__group-status--green {
  color: var(--tms-green);
  background: #e9f9f1;
}

.route-card__group-status--orange {
  color: var(--tms-orange);
  background: #fff4ea;
}

.route-card__group-status--red {
  color: var(--tms-red);
  background: #fff0f0;
}

.route-card__route {
  min-width: 0;
  color: var(--tms-text);
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.2;
}

.route-card__route :deep(.tms-icon),
.route-card__route :deep(.tms-icon__svg),
.route-card__route :deep(.wd-icon) {
  flex: 0 0 auto;
  color: var(--tms-primary);
}

.route-card__route text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.route-card__no-row {
  margin-top: 10rpx;
  color: var(--tms-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 22rpx;
  font-size: 23rpx;
  line-height: 1.35;
}

.route-card__points {
  position: relative;
  margin-top: 18rpx;
  padding: 18rpx 92rpx 18rpx 18rpx;
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

.route-card__dot text {
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.route-card__dot--start {
  background: var(--tms-green);
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
  font-size: 24rpx;
  line-height: 1.35;
}

.route-card__time {
  color: var(--tms-muted);
  font-size: 22rpx;
  line-height: 1.3;
}

.route-card__nav {
  position: absolute;
  right: 18rpx;
  top: 18rpx;
}

.route-card__nav-button {
  width: 50rpx;
  height: 50rpx;
  padding: 0;
  color: var(--tms-muted);
  background: transparent;
  border: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1rpx;
  font-size: 14rpx;
  line-height: 1;
  min-width: 0;
}

.route-card__nav-button :deep(.wd-button__content) {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4rpx;
  line-height: 1;
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

.route-card__nav-icon :deep(.uni-icons) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.route-card__nav-label {
  color: #526174;
  font-size: 18rpx;
  font-weight: 500;
  transform: scale(0.92);
  transform-origin: center top;
  line-height: 1;
}

.route-card__nav-button :deep(.wd-button__text) {
  font-size: 14rpx;
  line-height: 1;
  display: flex;
  flex-direction: column;
  gap : 4rpx;
}

.route-card__meta {
  margin: 18rpx 0 24rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.route-card__meta--task {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 26rpx;
}

.route-card__meta-item {
  min-width: 0;
  color: var(--tms-muted);
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 23rpx;
}

.route-card__meta-item--right {
  justify-content: flex-end;
}

.route-card__meta-item text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.route-card__compact {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.route-card__compact-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.route-card__compact-main {
  min-width: 0;
  flex: 1;
}

.route-card__route--compact {
  gap: 14rpx;
  font-size: 30rpx;
  line-height: 1.2;
}

.route-card__no-row--compact {
  margin-top: 10rpx;
}

.route-card__meta--compact {
  width: 100%;
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.route-card__meta--compact .route-card__meta-item {
  font-size: 22rpx;
}

.route-card__meta--compact .route-card__meta-item:first-child {
  justify-content: flex-start;
}

.route-card__meta-item--center {
  justify-content: center;
}

.route-card__compact-side {
  flex: 0 0 auto;
  color: var(--tms-light);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.route-card--list .route-card__route {
  font-size: 30rpx;
}

.route-card--list .route-card__points {
  margin-top: 16rpx;
  padding: 18rpx 18rpx;
  gap: 14rpx;
}

.route-card--list .route-card__points::before {
  left: 34rpx;
  top: 50rpx;
  bottom: 50rpx;
}

.route-card--list .route-card__meta {
  margin: 18rpx 0 0;
}
</style>
