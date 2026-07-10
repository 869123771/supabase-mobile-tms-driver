<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { useProfileStore } from '@/stores/profile'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { formatMeters } from '@/utils/format'

const profile = useProfileStore()
const dictionary = useDictionaryStore()

const vehicle = computed(() => profile.vehicle)

const metrics = computed(() => [
  {
    label: '载重',
    value: vehicle.value?.approvedLoadMass ?? '--',
    unit: vehicle.value?.approvedLoadMass === undefined ? '' : '吨'
  },
  {
    label: '车长',
    value: vehicle.value?.overallLength ? formatMeters(vehicle.value.overallLength) : '--'
  },
  { label: '车况', value: vehicleStatusLabel.value }
])
const vehicleTypeLabel = computed(() => dictionary.label('vehicleType', vehicle.value?.vehicleType))
const fuelTypeLabel = computed(() => dictionary.label('vehicleFuelType', vehicle.value?.fuelType))
const vehicleStatusLabel = computed(() =>
  dictionary.label('vehicleOperationStatus', vehicle.value?.operationStatus)
)
const auditStatusLabel = computed(() =>
  dictionary.label('vehicleAuditStatus', vehicle.value?.auditStatus)
)

onShow(() => {
  void load()
})

async function load() {
  try {
    await profile.load(true)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '车辆加载失败',
      icon: 'none'
    })
  }
}

function preview(url?: string) {
  if (!url) {
    uni.showToast({ title: '暂无证件图片', icon: 'none' })
    return
  }
  uni.previewImage({ urls: [url] })
}
</script>

<template>
  <view class="vehicle-page page safe-bottom">
    <TmsTopBar title="车辆信息" />

    <view class="vehicle-page__content">
      <view class="vehicle-card card">
        <view class="vehicle-card__body">
          <image
            class="vehicle-card__image"
            :src="vehicle?.vehiclePhotoUrl || FALLBACK_TRUCK_IMAGE"
            mode="aspectFill"
          />
          <view class="vehicle-card__info">
            <text class="vehicle-card__plate">{{ vehicle?.plateNo || '暂无车辆' }}</text>
            <text class="vehicle-card__model">
              {{ vehicleTypeLabel }} · {{ vehicle?.brandModel || '--' }}
            </text>
          </view>
          <text class="vehicle-card__tag">{{ vehicleStatusLabel }}</text>
        </view>
        <TmsMetricGrid :items="metrics" />
      </view>

      <view class="status-card card">
        <text class="section-title">车辆状态</text>
        <view class="status-card__row">
          <text>燃料类型</text>
          <text>{{ fuelTypeLabel }}</text>
        </view>
        <view class="status-card__row">
          <text>运营状态</text>
          <text>{{ vehicleStatusLabel }}</text>
        </view>
        <view class="status-card__row">
          <text>审核状态</text>
          <text>{{ auditStatusLabel }}</text>
        </view>
      </view>

      <view class="doc-card card">
        <text class="section-title">证件信息</text>
        <view class="doc-card__grid">
          <view class="doc-card__item" @tap="preview(vehicle?.drivingLicenseFrontUrl)">
            <wd-icon name="idcard" size="72rpx" />
            <text>行驶证</text>
          </view>
          <view class="doc-card__item" @tap="preview(vehicle?.operationLicenseUrl)">
            <wd-icon name="truck" size="76rpx" />
            <text>运输证</text>
          </view>
        </view>
      </view>
    </view>

    <TmsBottomNav active="vehicle" />
  </view>
</template>

<style scoped lang="scss">
.vehicle-page {
  padding-bottom: 150rpx;
}

.vehicle-page__content {
  padding: 20rpx 30rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.vehicle-card,
.status-card,
.doc-card {
  padding: 30rpx;
}

.vehicle-card__body {
  margin-bottom: 28rpx;
  display: grid;
  grid-template-columns: 100rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 26rpx;
}

.vehicle-card__image {
  width: 100rpx;
  height: 86rpx;
  border-radius: 8rpx;
  background: var(--tms-panel);
}

.vehicle-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.vehicle-card__plate {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__model {
  color: var(--tms-light);
  font-size: 25rpx;
}

.vehicle-card__tag {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  color: var(--tms-green);
  background: #e9f9f1;
  font-size: 25rpx;
  font-weight: 700;
}

.section-title {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
}

.status-card__row {
  min-height: 78rpx;
  border-bottom: 1rpx solid var(--tms-line);
  color: var(--tms-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
}

.status-card__row:first-of-type {
  margin-top: 18rpx;
}

.status-card__row:last-child {
  border-bottom: 0;
}

.status-card__row text:last-child {
  color: var(--tms-text);
  font-weight: 700;
}

.doc-card__grid {
  margin-top: 28rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22rpx;
}

.doc-card__item {
  height: 180rpx;
  border-radius: 12rpx;
  color: var(--tms-muted);
  background: var(--tms-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  font-size: 26rpx;
}
</style>
