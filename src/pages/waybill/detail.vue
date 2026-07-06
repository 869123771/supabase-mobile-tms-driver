<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { useWaybillStore } from '@/stores/waybill'
import { chooseImages } from '@/utils/file'
import { formatDateTime, formatMoney, maskPhone } from '@/utils/format'
import { openWaybillNavigation } from '@/utils/navigation'

const waybill = useWaybillStore()
const id = ref('')

const current = computed(() => waybill.current)
const isPending = computed(() => current.value?.status === 'pending')

const statusTitle = computed(() => {
  const status = current.value?.status
  if (status === 'accepted' || status === 'loading') return '待提货'
  if (status === 'transporting') return '运输中'
  if (status === 'unloading') return '待卸货'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return '待处理'
})

const statusHint = computed(() => {
  const item = current.value
  if (!item) return ''
  if (item.status === 'accepted' || item.status === 'loading') {
    return '提货后请上传装货单据和车辆照片'
  }
  if (item.status === 'transporting') return '到达目的地后请确认到达'
  if (item.status === 'unloading') return '卸货完成后上传回单照片'
  if (item.status === 'completed') return `已于 ${formatDateTime(item.completedAt)} 完成`
  if (item.status === 'cancelled') return '该运单已取消'
  return '请核对订单信息后接受任务'
})

const proofUrls = computed(() => waybill.proofs.map((item) => item.fileUrl).filter(Boolean))
const cargoNo = computed(
  () => current.value?.cargoNo || current.value?.goodsNo || current.value?.orderNo || '--'
)
const stationRows = computed(() => {
  const item = current.value
  if (!item) return []
  return [
    {
      label: '发货站',
      station: item.fromStationName || item.originCity || '--',
      name: item.senderName || item.shipperName || '--',
      phone: item.senderPhone || item.shipperPhone || ''
    },
    {
      label: '到货站',
      station: item.toStationName || item.destinationCity || '--',
      name: item.receiverName || '--',
      phone: item.receiverPhone || ''
    }
  ]
})

onLoad((query) => {
  id.value = String(query?.id || '')
  void load()
})

async function load() {
  if (!id.value) return
  try {
    await waybill.loadDetail(id.value)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '详情加载失败',
      icon: 'none'
    })
  }
}

function navigate() {
  openWaybillNavigation(current.value)
}

function back() {
  uni.navigateBack()
}

function callPhone(phone?: string) {
  if (!phone) {
    uni.showToast({ title: '暂无联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}

async function accept() {
  try {
    await waybill.acceptCurrent()
    uni.showToast({ title: '已接受任务', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
      icon: 'none'
    })
  }
}

async function uploadPickup() {
  try {
    const files = await chooseImages(3)
    if (files.length === 0) return
    await waybill.uploadPickup(files)
    uni.showToast({ title: '提货照片已上传', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '上传失败',
      icon: 'none'
    })
  }
}

async function confirmArrival() {
  try {
    await waybill.confirmArrival()
    uni.showToast({ title: '已确认到达', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
      icon: 'none'
    })
  }
}

async function complete() {
  try {
    const files = await chooseImages(3)
    await waybill.completeCurrent(files)
    uni.showToast({ title: '运单已完成', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
      icon: 'none'
    })
  }
}

function cancel() {
  uni.showModal({
    title: '取消运单',
    content: '确认取消当前运单吗？',
    confirmColor: '#f05252',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await waybill.cancelCurrent()
        uni.showToast({ title: '已取消', icon: 'success' })
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '取消失败',
          icon: 'none'
        })
      }
    }
  })
}

function viewReceipt() {
  if (proofUrls.value.length === 0) {
    uni.showToast({ title: '暂无回单文件', icon: 'none' })
    return
  }
  uni.previewImage({ urls: proofUrls.value })
}
</script>

<template>
  <view class="detail-page page" :class="{ 'detail-page--pending': isPending }">
    <view v-if="isPending" class="map-hero">
      <button class="map-hero__back" hover-class="none" @tap="back">
        <TmsIcon name="back" size="40rpx" />
      </button>
      <view class="map-hero__route-line">
        <view class="map-hero__path" />
        <view class="map-hero__pin map-hero__pin--start">
          <TmsIcon name="location" size="28rpx" color="#fff" />
        </view>
        <view class="map-hero__pin map-hero__pin--end">
          <TmsIcon name="flag" size="28rpx" color="#fff" />
        </view>
        <text class="map-hero__label map-hero__label--start">{{ current?.originCity }} · 程记石材</text>
        <text class="map-hero__label map-hero__label--end">{{ current?.destinationCity }} · 杨柳湾小区</text>
      </view>
    </view>
    <view v-else class="detail-page__blue">
      <TmsTopBar title="任务详情" show-back />
      <view class="detail-page__status">
        <TmsIcon name="document" size="42rpx" />
        <text>{{ statusTitle }}</text>
      </view>
      <text class="detail-page__hint">{{ statusHint }}</text>
    </view>

    <scroll-view scroll-y class="detail-page__scroll">
      <view v-if="current" class="detail-page__content">
        <TmsRouteCard
          :waybill="current"
          :show-progress="!isPending"
          :clickable="false"
          @navigate="navigate"
        >
          <view v-if="!isPending" class="detail-actions">
            <button
              v-if="current.status === 'accepted' || current.status === 'loading'"
              class="detail-actions__outline"
              hover-class="none"
              @tap.stop="cancel"
            >
              取消运单
            </button>
            <button
              v-if="current.status === 'accepted' || current.status === 'loading'"
              class="detail-actions__primary"
              hover-class="none"
              :loading="waybill.actionLoading"
              @tap.stop="uploadPickup"
            >
              上传提货照片
            </button>
            <button
              v-else-if="current.status === 'transporting'"
              class="detail-actions__primary detail-actions__primary--wide"
              hover-class="none"
              :loading="waybill.actionLoading"
              @tap.stop="confirmArrival"
            >
              确认到达
            </button>
            <button
              v-else-if="current.status === 'unloading'"
              class="detail-actions__primary detail-actions__primary--wide"
              hover-class="none"
              :loading="waybill.actionLoading"
              @tap.stop="complete"
            >
              完成卸货
            </button>
            <button
              v-else-if="current.status === 'completed'"
              class="detail-actions__outline detail-actions__outline--right"
              hover-class="none"
              @tap.stop="viewReceipt"
            >
              查看单据
            </button>
          </view>
        </TmsRouteCard>

        <view class="info-card card">
          <text class="section-title">订单信息</text>
          <view class="info-card__grid">
            <view>
              <text>货号</text>
              <text>{{ cargoNo }}</text>
            </view>
            <view>
              <text>货物类型</text>
              <text>{{ current.cargoType || current.cargoName || '--' }}</text>
            </view>
            <view>
              <text>货物重量</text>
              <text>{{ current.cargoWeightTon || '--' }}吨</text>
            </view>
            <view>
              <text>货物体积</text>
              <text>{{ current.cargoVolumeM3 || '--' }}m³</text>
            </view>
            <view>
              <text>数量</text>
              <text>{{ current.cargoQuantity || '--' }}</text>
            </view>
            <view>
              <text>运费</text>
              <text>{{ formatMoney(current.freightAmount) }}</text>
            </view>
          </view>
        </view>

        <view class="info-card card">
          <text class="section-title">站点信息</text>
          <view class="station-card__rows">
            <view v-for="row in stationRows" :key="row.label" class="station-card__row">
              <text class="station-card__label">{{ row.label }}</text>
              <view class="station-card__main">
                <text class="station-card__station">{{ row.station }}</text>
                <text class="station-card__name">{{ row.name }}</text>
                <text class="station-card__phone">{{ maskPhone(row.phone) }}</text>
              </view>
              <button class="station-card__call" hover-class="none" @tap="callPhone(row.phone)">
                <TmsIcon name="phone" size="30rpx" color="#fff" />
              </button>
            </view>
          </view>
        </view>

        <view v-if="waybill.proofs.length" class="proof-card card">
          <text class="section-title">上传单据</text>
          <view class="proof-card__grid">
            <image
              v-for="proof in waybill.proofs"
              :key="proof.id"
              class="proof-card__image"
              :src="proof.fileUrl"
              mode="aspectFill"
              @tap="viewReceipt"
            />
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="current && isPending" class="pending-footer">
      <view>
        <text class="pending-footer__label">运费</text>
        <text class="pending-footer__money">{{ formatMoney(current.freightAmount) }}</text>
      </view>
      <button
        class="pending-footer__button"
        hover-class="none"
        :loading="waybill.actionLoading"
        @tap="accept"
      >
        <TmsIcon name="check" size="34rpx" />
        <text>接受任务</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  background: var(--tms-bg);
}

.detail-page__blue {
  color: #fff;
  background: var(--tms-primary);
  padding-bottom: 34rpx;
}

.detail-page__status {
  margin: 18rpx 42rpx 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 34rpx;
  font-weight: 800;
}

.detail-page__hint {
  display: block;
  margin: 18rpx 42rpx 0 98rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.map-hero {
  position: relative;
  height: 560rpx;
  padding: calc(64rpx + env(safe-area-inset-top)) 34rpx 42rpx;
  overflow: hidden;
  color: #283142;
  background:
    radial-gradient(circle at 24% 30%, rgba(42, 190, 130, 0.16) 0 11%, transparent 12%),
    radial-gradient(circle at 70% 48%, rgba(42, 190, 130, 0.12) 0 15%, transparent 16%),
    linear-gradient(120deg, transparent 28%, rgba(255, 152, 72, 0.28) 28% 30%, transparent 30%),
    linear-gradient(34deg, transparent 45%, rgba(255, 152, 72, 0.24) 45% 48%, transparent 48%),
    #eef4ef;
}

.map-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(91, 110, 132, 0.09) 1px, transparent 1px),
    linear-gradient(0deg, rgba(91, 110, 132, 0.09) 1px, transparent 1px);
  background-size: 112rpx 112rpx;
}

.map-hero__back {
  position: relative;
  z-index: 2;
  width: 68rpx;
  height: 68rpx;
  padding: 0;
  border-radius: 50%;
  color: #3b4658;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 22rpx rgba(50, 63, 82, 0.08);
}

.map-hero__route-line {
  position: absolute;
  z-index: 1;
  left: 56rpx;
  right: 56rpx;
  top: calc(118rpx + env(safe-area-inset-top));
  bottom: 42rpx;
}

.map-hero__path {
  position: absolute;
  left: 46%;
  top: 38rpx;
  width: 132rpx;
  height: 326rpx;
  border-left: 20rpx solid #25bfa4;
  border-bottom: 20rpx solid #25bfa4;
  border-radius: 90rpx;
  transform: rotate(18deg);
}

.map-hero__pin {
  position: absolute;
  z-index: 2;
  width: 54rpx;
  height: 54rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-hero__pin--start {
  right: 148rpx;
  top: 18rpx;
  background: var(--tms-green);
}

.map-hero__pin--end {
  left: 152rpx;
  bottom: 70rpx;
  background: var(--tms-orange);
}

.map-hero__label {
  position: absolute;
  z-index: 2;
  max-width: 330rpx;
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  color: #303846;
  background: #fff;
  font-size: 24rpx;
  font-weight: 800;
  box-shadow: 0 8rpx 22rpx rgba(50, 63, 82, 0.08);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.map-hero__label--start {
  right: 2rpx;
  top: 0;
}

.map-hero__label--end {
  left: 0;
  bottom: 122rpx;
}

.detail-page__scroll {
  height: calc(100vh - 298rpx);
}

.detail-page--pending .detail-page__scroll {
  height: calc(100vh - 560rpx);
  margin-top: -28rpx;
}

.detail-page__content {
  padding: 28rpx 30rpx 176rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.detail-page--pending .detail-page__content {
  padding-bottom: 188rpx;
}

.section-title {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
}

.detail-actions {
  margin-top: 32rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18rpx;
}

.detail-actions__primary,
.detail-actions__outline {
  height: 76rpx;
  min-width: 190rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 27rpx;
  font-weight: 800;
}

.detail-actions__primary {
  color: #fff;
  background: var(--tms-primary);
}

.detail-actions__primary--wide {
  width: 100%;
}

.detail-actions__outline {
  color: var(--tms-primary);
  background: #fff;
  border: 2rpx solid var(--tms-primary);
}

.detail-actions__outline--right {
  margin-left: auto;
}

.info-card,
.proof-card {
  padding: 30rpx;
  border-radius: 12rpx;
}

.info-card__grid {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.info-card__grid > view,
.info-card__rows > view {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.info-card__rows {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx 24rpx;
}

.info-card__grid text:first-child,
.info-card__rows text:first-child {
  color: var(--tms-muted);
  font-size: 24rpx;
}

.info-card__grid text:last-child,
.info-card__rows text:last-child {
  overflow: hidden;
  color: var(--tms-text);
  font-size: 28rpx;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.station-card__rows {
  margin-top: 26rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.station-card__row {
  min-width: 0;
  display: grid;
  grid-template-columns: 92rpx minmax(0, 1fr) 46rpx;
  align-items: center;
  gap: 14rpx;
}

.station-card__label {
  color: var(--tms-muted);
  font-size: 26rpx;
}

.station-card__main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: var(--tms-text);
  font-size: 27rpx;
  font-weight: 700;
}

.station-card__station,
.station-card__name,
.station-card__phone {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.station-card__station {
  max-width: 150rpx;
}

.station-card__name {
  max-width: 92rpx;
}

.station-card__phone {
  max-width: 142rpx;
}

.station-card__call {
  width: 44rpx;
  height: 44rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--tms-green);
  display: flex;
  align-items: center;
  justify-content: center;
}

.proof-card__grid {
  margin-top: 26rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.proof-card__image {
  width: 100%;
  height: 150rpx;
  border-radius: 8rpx;
  background: var(--tms-panel);
}

.pending-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  min-height: calc(128rpx + env(safe-area-inset-bottom));
  padding: 22rpx 30rpx calc(22rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 26rpx;
  box-shadow: 0 -8rpx 26rpx rgba(40, 45, 54, 0.06);
}

.pending-footer__label {
  display: block;
  color: var(--tms-muted);
  font-size: 24rpx;
}

.pending-footer__money {
  display: block;
  margin-top: 6rpx;
  color: var(--tms-primary);
  font-size: 40rpx;
  font-weight: 900;
}

.pending-footer__button {
  flex: 0 0 318rpx;
  height: 82rpx;
  padding: 0;
  border-radius: 999rpx;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  font-size: 30rpx;
  font-weight: 800;
}
</style>
