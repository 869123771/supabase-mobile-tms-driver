<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { getUserFacingErrorMessage } from '@/api/supabase'
import { useDictionaryStore } from '@/stores/dictionary'
import { useProfileStore } from '@/stores/profile'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { formatMeters, normalizeVehicleLoadTon } from '@/utils/format'

const profile = useProfileStore()
const dictionary = useDictionaryStore()

const vehicle = computed(() => profile.vehicle)
const initialLoading = ref(!profile.summary)
const syncing = ref(false)
const loadError = ref('')
const showSkeleton = computed(() => !profile.summary && (initialLoading.value || Boolean(loadError.value)))
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
  if (syncing.value) return
  syncing.value = true
  if (!profile.summary) initialLoading.value = true
  loadError.value = ''
  try {
    await profile.load(true)
  } catch (error) {
    loadError.value = getUserFacingErrorMessage(error, '车辆档案同步失败，请重试')
  } finally {
    syncing.value = false
    initialLoading.value = false
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

    <scroll-view scroll-y class="vehicle-page__scroll">
    <TmsPageSkeleton
      v-if="showSkeleton"
      label="正在同步车辆档案…"
      :error="loadError"
      @retry="load"
    />
    <view v-else class="vehicle-page__content">
      <view v-if="loadError" class="vehicle-page__sync-error" role="alert">
        <text>档案同步失败，当前显示上次的信息</text>
        <button @tap="load">重试</button>
      </view>
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
            aria-label="当前绑定车辆照片"
          />
          <view class="vehicle-card__info">
            <view class="vehicle-card__plate-row">
              <text class="vehicle-card__plate">{{ vehicle?.plateNo || '暂无车辆' }}</text>
              <text class="vehicle-card__tag"><text />{{ vehicleStatusLabel }}</text>
            </view>
            <text class="vehicle-card__model">
              {{ vehicleTypeLabel }} · {{ vehicle?.brandModel || '--' }}
            </text>
          </view>
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
          <button
            class="doc-card__item"
            aria-label="预览行驶证"
            hover-class="doc-card__item--pressed"
            @tap="preview(vehicle?.drivingLicenseFrontUrl)"
          >
            <view class="doc-card__icon"><TmsIcon name="document" size="46rpx" /></view>
            <view>
              <text class="doc-card__name">行驶证</text>
              <text class="doc-card__status">{{ vehicle?.drivingLicenseFrontUrl ? '已上传' : '待上传' }}</text>
            </view>
            <wd-icon name="right" size="28rpx" />
          </button>
          <button
            class="doc-card__item"
            aria-label="预览运输证"
            hover-class="doc-card__item--pressed"
            @tap="preview(vehicle?.operationLicenseUrl)"
          >
            <view class="doc-card__icon"><TmsIcon name="vehicle" size="48rpx" /></view>
            <view>
              <text class="doc-card__name">运输证</text>
              <text class="doc-card__status">{{ vehicle?.operationLicenseUrl ? '已上传' : '待上传' }}</text>
            </view>
            <wd-icon name="right" size="28rpx" />
          </button>
        </view>
      </view>
    </view>
    </scroll-view>

    <TmsBottomNav active="vehicle" />
  </view>
</template>

<style scoped lang="scss">
.vehicle-page {
  height: 100vh;
  height: 100dvh;
  padding-bottom: var(--tms-tabbar-space);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.vehicle-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}

.vehicle-page__content {
  padding: 24rpx 28rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.vehicle-page__sync-error {
  min-width: 0;
  padding: 16rpx 20rpx;
  border: 1rpx solid #f4d8b0;
  border-radius: var(--tms-radius-md);
  color: #925a13;
  background: #fff9ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 22rpx;
  line-height: 1.4;
}

.vehicle-page__sync-error text {
  min-width: 0;
}

.vehicle-page__sync-error button {
  flex: 0 0 auto;
  min-width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0 12rpx;
  border: 0;
  color: var(--tms-primary);
  background: transparent;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 88rpx;
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
  grid-template-columns: 116rpx minmax(0, 1fr);
  align-items: center;
  gap: 22rpx;
}

.vehicle-card__image {
  width: 116rpx;
  height: 94rpx;
  border-radius: 18rpx;
  background: #f7f9fc url('/static/truck.svg') center / cover no-repeat;
  box-shadow: 0 10rpx 24rpx rgba(40, 52, 80, 0.1);
}

.vehicle-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.vehicle-card__plate-row {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.vehicle-card__plate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__model {
  display: -webkit-box;
  overflow: hidden;
  color: #9aa5b7;
  font-size: 25rpx;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.vehicle-card__tag {
  flex: 0 0 auto;
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
  width: 100%;
  min-height: 116rpx;
  margin: 0;
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
  line-height: 1.2;
  text-align: left;
}

.doc-card__item::after {
  border: 0;
}

.doc-card__item--pressed,
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
  text-align: left;
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
