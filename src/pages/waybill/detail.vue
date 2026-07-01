<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { useWaybillStore } from '@/stores/waybill'
import { chooseImages } from '@/utils/file'
import { formatDateTime, formatMoney } from '@/utils/format'

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
    return '提货后请拍照上传装货单据和货车照片'
  }
  if (item.status === 'transporting') return '到达目的地后请确认到达'
  if (item.status === 'unloading') return '卸货完成后上传回单照片'
  if (item.status === 'completed') return `已于${formatDateTime(item.completedAt)}送达!`
  if (item.status === 'cancelled') return '该运单已取消'
  return '请确认运单信息后接受任务'
})

const proofUrls = computed(() => waybill.proofs.map((item) => item.fileUrl).filter(Boolean))

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
  uni.showToast({ title: '已为你打开导航意图', icon: 'none' })
}

function back() {
  uni.navigateBack()
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
        <wd-icon name="arrow-left" size="44rpx" />
      </button>
      <view class="map-hero__route">
        <text class="map-hero__label map-hero__label--start">{{ current?.originCity }} · 程记石材</text>
        <view class="map-hero__path">
          <text class="map-hero__pin map-hero__pin--start">起</text>
          <text class="map-hero__pin map-hero__pin--end">终</text>
        </view>
        <text class="map-hero__label map-hero__label--end">{{ current?.destinationCity }} · 杨柳湾小区</text>
      </view>
    </view>
    <view v-else class="detail-page__blue">
      <TmsTopBar title="任务详情" show-back />
      <view class="detail-page__status">
        <wd-icon name="file-text" size="44rpx" />
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

        <view class="cargo-card card">
          <text class="section-title">货物信息</text>
          <view class="cargo-card__rows">
            <view class="cargo-card__row">
              <text>货物类型</text>
              <text>{{ current.cargoType || current.cargoName || '电子产品' }}</text>
            </view>
            <view class="cargo-card__row">
              <text>货物重量</text>
              <text>{{ current.cargoWeightTon || '--' }}吨</text>
            </view>
            <view class="cargo-card__row">
              <text>货物体积</text>
              <text>{{ current.cargoVolumeM3 || '--' }}m³</text>
            </view>
            <view class="cargo-card__row">
              <text>数量</text>
              <text>{{ current.cargoQuantity || '--' }}</text>
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
        <text class="pending-footer__label">运费：</text>
        <text class="pending-footer__money">{{ formatMoney(current.freightAmount) }}</text>
      </view>
      <button
        class="pending-footer__button"
        hover-class="none"
        :loading="waybill.actionLoading"
        @tap="accept"
      >
        <wd-icon name="check-circle" size="36rpx" />
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
  padding-bottom: 36rpx;
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
  overflow: hidden;
  background:
    linear-gradient(120deg, transparent 28%, rgba(48, 178, 143, 0.22) 28% 31%, transparent 31%),
    linear-gradient(34deg, transparent 43%, rgba(48, 178, 143, 0.24) 43% 47%, transparent 47%),
    #eef3ec;
}

.map-hero::before,
.map-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(255, 145, 66, 0.32) 1px, transparent 1px),
    linear-gradient(0deg, rgba(91, 110, 132, 0.12) 1px, transparent 1px);
  background-size: 118rpx 118rpx, 96rpx 96rpx;
}

.map-hero__back {
  position: absolute;
  z-index: 2;
  left: 36rpx;
  top: calc(52rpx + env(safe-area-inset-top));
  width: 68rpx;
  height: 68rpx;
  padding: 0;
  border-radius: 50%;
  color: #252b35;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-hero__route {
  position: absolute;
  z-index: 1;
  inset: 118rpx 72rpx 60rpx;
}

.map-hero__path {
  position: absolute;
  left: 48%;
  top: 32rpx;
  width: 96rpx;
  height: 342rpx;
  border-radius: 80rpx;
  border-left: 18rpx solid #20bca4;
  border-bottom: 18rpx solid #20bca4;
  transform: rotate(18deg);
}

.map-hero__pin {
  position: absolute;
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25rpx;
  font-weight: 800;
}

.map-hero__pin--start {
  right: -26rpx;
  top: -28rpx;
  background: #35bf8d;
}

.map-hero__pin--end {
  left: -48rpx;
  bottom: -32rpx;
  background: var(--tms-orange);
}

.map-hero__label {
  position: absolute;
  z-index: 2;
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  color: #303541;
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgba(50, 63, 82, 0.08);
  font-size: 24rpx;
  font-weight: 800;
}

.map-hero__label--start {
  right: 10rpx;
  top: 0;
}

.map-hero__label--end {
  left: 0;
  bottom: 46rpx;
}

.detail-page__scroll {
  height: calc(100vh - 298rpx);
}

.detail-page--pending .detail-page__scroll {
  height: calc(100vh - 560rpx);
  margin-top: -32rpx;
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
  margin-top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 22rpx;
}

.detail-actions__primary,
.detail-actions__outline {
  height: 76rpx;
  min-width: 198rpx;
  padding: 0 30rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
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

.cargo-card,
.proof-card {
  padding: 30rpx;
}

.cargo-card__rows {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
}

.cargo-card__row {
  min-height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  color: var(--tms-text);
  font-size: 28rpx;
}

.cargo-card__row text:first-child {
  color: var(--tms-muted);
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
  color: var(--tms-text);
  font-size: 28rpx;
}

.pending-footer__money {
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
