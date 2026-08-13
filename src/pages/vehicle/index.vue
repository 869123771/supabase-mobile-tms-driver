<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { useProfileStore } from '@/stores/profile'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { formatMeters, normalizeVehicleLoadTon } from '@/utils/format'

const profile = useProfileStore()
const dictionary = useDictionaryStore()

const vehicle = computed(() => profile.vehicle)
const approvedLoadTon = computed(() => normalizeVehicleLoadTon(vehicle.value?.approvedLoadMass))

const metrics = computed(() => [
  {
    label: '载重',
    value: approvedLoadTon.value ?? '--',
    unit: approvedLoadTon.value === undefined ? '' : '吨'
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
    <TmsTopBar title="车辆中心" eyebrow="车辆档案" subtitle="查看绑定车辆与证件状态" />

    <view class="vehicle-page__content">
      <view class="vehicle-card card">
        <view class="vehicle-card__eyebrow">
          <text>当前绑定车辆</text>
          <text>档案同步</text>
        </view>
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
          <text class="vehicle-card__tag"><text />{{ vehicleStatusLabel }}</text>
        </view>
        <TmsMetricGrid :items="metrics" />
      </view>

      <view class="status-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">运营信息</text>
            <text class="section-title">车辆状态</text>
          </view>
          <text class="section-head__hint">实时档案</text>
        </view>
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
        <view class="section-head">
          <view>
            <text class="section-eyebrow">证件管理</text>
            <text class="section-title">证件信息</text>
          </view>
          <text class="section-head__hint">点击预览</text>
        </view>
        <view class="doc-card__grid">
          <view class="doc-card__item" @tap="preview(vehicle?.drivingLicenseFrontUrl)">
            <view class="doc-card__icon"><TmsIcon name="document" size="46rpx" /></view>
            <view>
              <text class="doc-card__name">行驶证</text>
              <text class="doc-card__status">{{ vehicle?.drivingLicenseFrontUrl ? '已上传' : '待上传' }}</text>
            </view>
            <wd-icon name="chevron-right" size="28rpx" />
          </view>
          <view class="doc-card__item" @tap="preview(vehicle?.operationLicenseUrl)">
            <view class="doc-card__icon"><TmsIcon name="vehicle" size="48rpx" /></view>
            <view>
              <text class="doc-card__name">运输证</text>
              <text class="doc-card__status">{{ vehicle?.operationLicenseUrl ? '已上传' : '待上传' }}</text>
            </view>
            <wd-icon name="chevron-right" size="28rpx" />
          </view>
        </view>
      </view>
    </view>

    <TmsBottomNav active="vehicle" />
  </view>
</template>

<style scoped lang="scss">
.vehicle-page {
  padding-bottom: 190rpx;
}

.vehicle-page__content {
  padding: 24rpx 28rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.vehicle-card,
.status-card,
.doc-card {
  padding: 30rpx;
}

.vehicle-card {
  background:
    radial-gradient(circle at 92% 0, rgba(79, 70, 229, 0.1), transparent 220rpx),
    #fff;
  box-shadow: var(--tms-shadow-md);
}

.vehicle-card__eyebrow {
  margin-bottom: 24rpx;
  color: #748096;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.vehicle-card__eyebrow text:last-child {
  color: #4f46e5;
}

.vehicle-card__body {
  margin-bottom: 28rpx;
  display: grid;
  grid-template-columns: 116rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 22rpx;
}

.vehicle-card__image {
  width: 116rpx;
  height: 94rpx;
  border-radius: 18rpx;
  background: #f7f9fc;
  box-shadow: 0 10rpx 24rpx rgba(40, 52, 80, 0.1);
}

.vehicle-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.vehicle-card__plate {
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__model {
  color: #9aa5b7;
  font-size: 25rpx;
}

.vehicle-card__tag {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  color: #059669;
  background: #ecfdf5;
  display: flex;
  align-items: center;
  gap: 9rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.vehicle-card__tag > text {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: currentColor;
}

.section-title {
  display: block;
  margin-top: 7rpx;
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.section-head__hint {
  padding-bottom: 2rpx;
  color: #748096;
  font-size: 21rpx;
}

.status-card__row {
  min-height: 82rpx;
  border-bottom: 1rpx solid #e8ecf3;
  color: #748096;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
}

.status-card__row:first-of-type {
  margin-top: 22rpx;
}

.status-card__row:last-child {
  border-bottom: 0;
}

.status-card__row text:last-child {
  color: #172033;
  font-weight: 700;
}

.doc-card__grid {
  margin-top: 28rpx;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16rpx;
}

.doc-card__item {
  min-height: 116rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid #e8ecf3;
  border-radius: 18rpx;
  color: #748096;
  background: linear-gradient(145deg, #f9fafc, #f4f7fb);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 18rpx;
  font-size: 26rpx;
}


.doc-card__item:active {
  border-color: rgba(79, 70, 229, 0.28);
  background: #f2f4ff;
}

.doc-card__icon {
  flex: 0 0 76rpx;
  width: 76rpx;
  height: 76rpx;
  border-radius: 22rpx;
  color: #4f46e5;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-card__item > view:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.doc-card__name,
.doc-card__status {
  display: block;
}

.doc-card__name {
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
}

.doc-card__status {
  margin-top: 8rpx;
  color: #748096;
  font-size: 21rpx;
  font-weight: 600;
}
</style>
