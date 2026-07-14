<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import TmsRouteMap from '@/components/business/TmsRouteMap.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { useWaybillStore } from '@/stores/waybill'
import { chooseImages } from '@/utils/file'
import { formatDateTime, formatMoney, formatTon, maskPhone } from '@/utils/format'
import { openWaybillNavigation } from '@/utils/navigation'

const waybill = useWaybillStore()
const dictionary = useDictionaryStore()
const id = ref('')

const current = computed(() => waybill.current)
const isPending = computed(() => current.value?.status === 'pending')
const isCompleted = computed(() => current.value?.status === 'completed')
const isAccepted = computed(() => current.value?.status === 'accepted')
const isLoading = computed(() => current.value?.status === 'loading')
const isTransporting = computed(() => current.value?.status === 'transporting')
const isUnloading = computed(() => current.value?.status === 'unloading')
const isSigned = computed(() => current.value?.status === 'signed')

const statusTitle = computed(() => {
  return dictionary.label('tmsWaybillStatus', current.value?.status, '待处理')
})

const statusHint = computed(() => {
  const item = current.value
  if (!item) return ''
  if (item.status === 'accepted') {
    return '提货后请拍照上传装货单据和货车照片'
  }
  if (item.status === 'loading') return '提货凭证已上传，请确认发车'
  if (item.status === 'transporting') return '到达目的地后请确认到达'
  if (item.status === 'unloading') return '卸货完成后上传回单照片'
  if (item.status === 'signed') return '卸货单据已提交，等待收货方签收'
  if (item.status === 'completed') return `已于${formatDateTime(item.completedAt || item.unloadedAt)}送达!`
  if (item.status === 'cancelled') return '该运单已取消'
  return '请核对订单信息后接受任务'
})

const proofUrls = computed(() => waybill.proofs.map((item) => item.fileUrl).filter(Boolean))
const cargoTypeLabel = computed(() => {
  const item = current.value
  if (!item) return '--'
  return dictionary.labelAny(
    ['tmsCustomerPriceCargoType', 'tmsCargoUnit'],
    item.cargoType,
    item.cargoName || '--'
  )
})
const cargoRows = computed(() => {
  const item = current.value
  if (!item) return []
  return [
    { label: '货物类型', value: cargoTypeLabel.value },
    { label: '货物重量', value: formatTon(item.cargoWeightTon) },
    { label: '货物体积', value: item.cargoVolumeM3 ? `${item.cargoVolumeM3}m³` : '--' },
    { label: '数量', value: item.cargoQuantity || '--' }
  ]
})
const stationRows = computed(() => {
  const item = current.value
  if (!item) return []
  return [
    {
      label: '发货站',
      station: item.fromStationName || item.originCity || '--',
      name: item.senderName || item.shipperName || '--',
      phone: item.senderPhone || item.shipperPhone || '',
      address: item.senderAddress || item.shipperAddress || '--'
    },
    {
      label: '到货站',
      station: item.toStationName || item.destinationCity || '--',
      name: item.receiverName || '--',
      phone: item.receiverPhone || '',
      address: item.receiverAddress || '--'
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

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/waybill/index' })
}

function navigate() {
  openWaybillNavigation(current.value)
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

async function confirmDeparture() {
  try {
    await waybill.confirmDeparture()
    uni.showToast({ title: '已确认发车', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
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
    uni.showToast({ title: '已提交待签收', icon: 'success' })
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
    <TmsRouteMap v-if="isPending" :waybill="current" @back="back" />
    <view v-else class="detail-page__blue">
      <TmsTopBar title="任务详情" show-back />
      <view class="detail-page__status">
        <TmsIcon name="document" size="42rpx" />
        <view>
          <text class="detail-page__status-title">{{ statusTitle }}</text>
          <text class="detail-page__hint">{{ statusHint }}</text>
        </view>
      </view>
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
            <wd-button
              v-if="isAccepted && !isLoading"
              class="detail-actions__outline"
              type="primary"
              plain
              :round="false"
              @click.stop="cancel"
            >
              取消运单
            </wd-button>
            <wd-button
              v-if="isAccepted && !isLoading"
              class="detail-actions__primary"
              type="primary"
              :round="false"
              :loading="waybill.actionLoading"
              loading-color="#ffffff"
              :disabled="waybill.actionLoading"
              @click.stop="uploadPickup"
            >
              上传提货照片
            </wd-button>
            <wd-button
              v-else-if="isLoading"
              class="detail-actions__primary detail-actions__primary--wide"
              type="primary"
              :round="false"
              :loading="waybill.actionLoading"
              loading-color="#ffffff"
              :disabled="waybill.actionLoading"
              @click.stop="confirmDeparture"
            >
              确认发车
            </wd-button>
            <wd-button
              v-else-if="isTransporting"
              class="detail-actions__primary detail-actions__primary--wide"
              type="primary"
              :round="false"
              :loading="waybill.actionLoading"
              loading-color="#ffffff"
              :disabled="waybill.actionLoading"
              @click.stop="confirmArrival"
            >
              确认到达
            </wd-button>
            <wd-button
              v-else-if="isUnloading"
              class="detail-actions__primary detail-actions__primary--wide"
              type="primary"
              :round="false"
              :loading="waybill.actionLoading"
              loading-color="#ffffff"
              :disabled="waybill.actionLoading"
              @click.stop="complete"
            >
              完成卸货
            </wd-button>
            <wd-button
              v-else-if="isSigned || isCompleted"
              class="detail-actions__outline detail-actions__outline--right"
              type="primary"
              plain
              :round="false"
              @click.stop="viewReceipt"
            >
              查看单据
            </wd-button>
          </view>
        </TmsRouteCard>

        <view class="info-card card">
          <text class="section-title">货物信息</text>
          <view class="info-list">
            <view v-for="row in cargoRows" :key="row.label" class="info-list__row">
              <text>{{ row.label }}</text>
              <text>{{ row.value }}</text>
            </view>
          </view>
        </view>

        <view class="info-card card">
          <text class="section-title">站点信息</text>
          <view class="station-list">
            <view v-for="row in stationRows" :key="row.label" class="station-list__row">
              <text class="station-list__label">{{ row.label }}</text>
              <view class="station-list__main">
                <view class="station-list__head">
                  <text class="station-list__station">{{ row.station }}</text>
                  <text class="station-list__name">{{ row.name }}</text>
                </view>
                <text class="station-list__phone">{{ maskPhone(row.phone) }}</text>
                <text class="station-list__address">{{ row.address }}</text>
              </view>
              <wd-button
                class="station-list__call"
                type="icon"
                custom-style="width: 50rpx; min-width: 50rpx; height: 50rpx; padding: 0; border-radius: 50%; background: #25bf75; color: #fff;"
                @click="callPhone(row.phone)"
              >
                <wd-icon name="phone" size="30rpx" />
              </wd-button>
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
      <wd-button
        class="pending-footer__button"
        type="primary"
        :round="false"
        :loading="waybill.actionLoading"
        loading-color="#ffffff"
        :disabled="waybill.actionLoading"
        @click="accept"
      >
        <wd-icon v-if="!waybill.actionLoading" name="check-circle" size="34rpx" />
        <text>接受任务</text>
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100vh;
  overflow: hidden;
  background: var(--tms-bg);
}

.detail-page__blue {
  color: #fff;
  background: var(--tms-primary);
}

.detail-page__status {
  padding: 22rpx 34rpx 34rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.detail-page__status-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.2;
}

.detail-page__hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  font-weight: 700;
  opacity: 0.92;
}

.detail-page__scroll {
  height: calc(100vh - 298rpx);
}

.detail-page--pending .detail-page__scroll {
  height: calc(100vh - 520rpx - 128rpx - env(safe-area-inset-bottom));
}

.detail-page__content {
  padding: 24rpx 30rpx 58rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-page--pending .detail-page__content {
  padding-top: 26rpx;
  padding-bottom: 34rpx;
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
  gap: 20rpx;
}

.detail-actions__primary,
.detail-actions__outline {
  height: 76rpx;
  min-width: 0;
  padding: 0 34rpx;
  border-radius: 999rpx;
  font-size: 27rpx;
  font-weight: 800;
}

.detail-actions__primary {
  color: #fff;
  background: var(--tms-primary);
  flex: 1;
  max-width: 260rpx;
}

.detail-actions__primary--wide {
  max-width: none;
  width: 100%;
}

.detail-actions__outline {
  flex: 0 0 190rpx;
  color: var(--tms-primary);
  background: #fff;
  border: 2rpx solid var(--tms-primary);
}

.detail-actions__outline--right {
  margin-left: auto;
}

.info-card,
.proof-card {
  padding: 32rpx 30rpx;
  border-radius: 16rpx;
}

.info-list {
  margin-top: 24rpx;
}

.info-list__row {
  min-height: 66rpx;
  color: var(--tms-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  font-size: 26rpx;
}

.info-list__row text:last-child {
  color: var(--tms-text);
  font-weight: 700;
  text-align: right;
}

.station-list {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.station-list__row {
  min-width: 0;
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 54rpx;
  align-items: center;
  gap: 16rpx;
}

.station-list__label {
  color: var(--tms-muted);
  font-size: 26rpx;
  line-height: 1.2;
}

.station-list__main {
  min-width: 0;
  color: var(--tms-text);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.station-list__head {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  align-items: center;
  gap: 12rpx;
}

.station-list__station,
.station-list__name,
.station-list__phone {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.station-list__phone {
  color: var(--tms-text);
  font-weight: 800;
  line-height: 1.2;
}

.station-list__address {
  color: var(--tms-muted);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.station-list__call {
  width: 50rpx;
  height: 50rpx;
  min-width: 50rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--tms-green);
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
  background: rgba(255, 255, 255, 0.97);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 26rpx;
  box-shadow: 0 -8rpx 26rpx rgba(40, 45, 54, 0.06);
}

.pending-footer__label {
  color: var(--tms-text);
  font-size: 26rpx;
}

.pending-footer__money {
  color: var(--tms-primary);
  font-size: 34rpx;
  font-weight: 900;
}

.pending-footer__button {
  flex: 0 0 328rpx;
  height: 86rpx;
  min-width: 0;
  padding: 0;
  border-radius: 999rpx;
  color: #fff;
  background: var(--tms-primary);
  font-size: 30rpx;
  font-weight: 800;
}

.pending-footer__button :deep(.wd-button__content) {
  gap: 10rpx;
}
</style>
