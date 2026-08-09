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
import { getWaybillRoutePoints } from '@/utils/route'

const waybill = useWaybillStore()
const dictionary = useDictionaryStore()
const id = ref('')
type DetailAction =
  | 'accept'
  | 'cancel'
  | 'pickup'
  | 'departure'
  | 'arrival'
  | 'signature'
  | 'complete'
const activeAction = ref<DetailAction | ''>('')

const current = computed(() => waybill.current)
const isPending = computed(() => current.value?.status === 'pending')
const isCompleted = computed(() => current.value?.status === 'completed')
const isAccepted = computed(() => current.value?.status === 'accepted')
const isLoading = computed(() => current.value?.status === 'loading')
const isTransporting = computed(() => current.value?.status === 'transporting')
const isUnloading = computed(() => current.value?.status === 'unloading')
const isSigned = computed(() => current.value?.status === 'signed')
const hasRouteCoordinates = computed(() => getWaybillRoutePoints(current.value).length >= 2)
const actionBusy = computed(() => Boolean(activeAction.value) || waybill.actionLoading)
const pickupProofCount = computed(
  () => waybill.proofs.filter((proof) => proof.proofType === 'pickup_photo').length
)
const deliveryProofCount = computed(
  () =>
    waybill.proofs.filter(
      (proof) => proof.proofType === 'delivery_photo' || proof.proofType === 'receipt'
    ).length
)
const hasPickupProof = computed(() => pickupProofCount.value > 0)
const hasDeliveryProof = computed(() => deliveryProofCount.value > 0)
const pickupActionLabel = computed(() => {
  if (activeAction.value === 'pickup') return hasPickupProof.value ? '正在确认提货' : '正在上传照片'
  return hasPickupProof.value ? '确认提货' : '上传提货照片'
})
const signatureActionLabel = computed(() => {
  if (activeAction.value === 'signature') {
    return hasDeliveryProof.value ? '正在确认签收' : '正在上传回单'
  }
  return hasDeliveryProof.value ? '确认签收' : '上传回单并确认签收'
})

const statusTitle = computed(() => {
  const status = current.value?.status
  if (status === 'accepted') return '待提货'
  if (status === 'loading') return '待发车'
  if (status === 'transporting') return '运输中'
  if (status === 'unloading') return '待卸货'
  if (status === 'signed') return '已签收'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return dictionary.label('tmsWaybillStatus', status, '待处理')
})

const statusHint = computed(() => {
  const item = current.value
  if (!item) return ''
  if (item.status === 'accepted') {
    if (hasPickupProof.value) return `已保存 ${pickupProofCount.value} 张提货照片，可确认提货`
    return '提货后请拍照上传装货单据和货车照片'
  }
  if (item.status === 'loading') return '提货凭证已上传，请确认发车'
  if (item.status === 'transporting') return '到达目的地后请确认到达'
  if (item.status === 'unloading') return '卸货完成后，请提交回单并确认签收'
  if (item.status === 'signed') return '签收资料已归档，请最后确认完成运单'
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
  if (actionBusy.value) return
  activeAction.value = 'accept'
  try {
    await waybill.acceptCurrent()
    uni.showToast({ title: '已接受任务', icon: 'success' })
  } catch (error) {
    showActionError(error, '接受任务失败，请稍后重试')
  } finally {
    activeAction.value = ''
  }
}

async function uploadPickup() {
  if (actionBusy.value) return
  try {
    const files = hasPickupProof.value ? [] : await chooseImages(3)
    if (!hasPickupProof.value && files.length === 0) return
    activeAction.value = 'pickup'
    await waybill.uploadPickup(files)
    uni.showToast({ title: '提货完成，开始运输', icon: 'success' })
  } catch (error) {
    showActionError(error, '照片上传失败，请检查网络后重试')
  } finally {
    activeAction.value = ''
  }
}

async function confirmDeparture() {
  if (actionBusy.value) return
  activeAction.value = 'departure'
  try {
    await waybill.confirmDeparture()
    uni.showToast({ title: '已确认发车', icon: 'success' })
  } catch (error) {
    showActionError(error, '确认发车失败，请稍后重试')
  } finally {
    activeAction.value = ''
  }
}

async function confirmArrival() {
  if (actionBusy.value) return
  activeAction.value = 'arrival'
  try {
    await waybill.confirmArrival()
    uni.showToast({ title: '已确认到达', icon: 'success' })
  } catch (error) {
    showActionError(error, '确认到达失败，请稍后重试')
  } finally {
    activeAction.value = ''
  }
}

async function submitSignature() {
  if (actionBusy.value) return
  try {
    const files = hasDeliveryProof.value ? [] : await chooseImages(3)
    if (!hasDeliveryProof.value && files.length === 0) return
    activeAction.value = 'signature'
    await waybill.submitSignature(files)
    uni.showToast({ title: '签收资料已提交', icon: 'success' })
  } catch (error) {
    showActionError(error, '签收提交失败，请检查网络后重试')
  } finally {
    activeAction.value = ''
  }
}

async function complete() {
  if (actionBusy.value) return
  try {
    activeAction.value = 'complete'
    await waybill.completeCurrent()
    uni.showToast({ title: '运单已完成', icon: 'success' })
  } catch (error) {
    showActionError(error, '完成运单失败，请稍后重试')
  } finally {
    activeAction.value = ''
  }
}

function showActionError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const title = /状态不允许|运输节点|已进入下一/.test(message)
    ? '运单状态已变化，请刷新后重试'
    : fallback
  uni.showToast({ title, icon: 'none', duration: 2600 })
}

function cancel() {
  uni.showModal({
    title: '取消运单',
    content: '确认取消当前运单吗？',
    confirmColor: '#f05252',
    success: async (result) => {
      if (!result.confirm) return
      activeAction.value = 'cancel'
      try {
        await waybill.cancelCurrent()
        uni.showToast({ title: '已取消', icon: 'success' })
      } catch (error) {
        showActionError(error, '取消失败，请稍后重试')
      } finally {
        activeAction.value = ''
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
  <view
    class="detail-page page"
    :class="{
      'detail-page--pending': isPending,
      'detail-page--route-empty': isPending && !hasRouteCoordinates
    }"
  >
    <TmsRouteMap v-if="isPending" :waybill="current" @back="back" />
    <view v-else class="detail-page__blue">
      <TmsTopBar title="任务详情" eyebrow="运单进度" subtitle="按当前运输节点完成操作" show-back />
      <view v-if="current" class="detail-page__status">
        <view class="detail-page__status-icon"><TmsIcon name="document" size="38rpx" /></view>
        <view>
          <text class="detail-page__status-title">{{ statusTitle }}</text>
          <text class="detail-page__hint">{{ statusHint }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="detail-page__scroll"
      :class="{ 'detail-page__scroll--header-only': !current && !isPending }"
    >
      <view v-if="current" class="detail-page__content">
        <TmsRouteCard
          :waybill="current"
          :show-progress="!isPending"
          :clickable="false"
          @navigate="navigate"
        >
          <view v-if="!isPending" class="detail-actions">
            <view v-if="isAccepted" class="detail-actions__helper">
              <wd-icon :name="hasPickupProof ? 'check-circle' : 'info-circle'" size="28rpx" />
              <text v-if="hasPickupProof">
                已保存 {{ pickupProofCount }} 张提货照片，可确认提货并进入待发车
              </text>
              <text v-else>请上传装货单据或车辆照片，最多选择 3 张</text>
            </view>
            <view v-else-if="isLoading" class="detail-actions__helper detail-actions__helper--success">
              <wd-icon name="check-circle" size="28rpx" />
              <text>提货凭证已保存，请确认车辆已发车</text>
            </view>
            <view v-else-if="isUnloading" class="detail-actions__helper">
              <wd-icon :name="hasDeliveryProof ? 'check-circle' : 'info-circle'" size="28rpx" />
              <text v-if="hasDeliveryProof">已保存 {{ deliveryProofCount }} 张回单，可直接确认签收</text>
              <text v-else>请上传签收回单，提交后运单进入“已签收”节点</text>
            </view>
            <view v-else-if="isSigned" class="detail-actions__helper detail-actions__helper--success">
              <wd-icon name="check-circle" size="28rpx" />
              <text>签收已确认，{{ deliveryProofCount }} 张回单已归档</text>
            </view>

            <view class="detail-actions__controls">
              <wd-button
                v-if="isAccepted"
                class="detail-actions__outline"
                type="error"
                plain
                :round="false"
                :disabled="actionBusy"
                @click.stop="cancel"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'cancel'" type="ring" color="#dc2626" size="28rpx" />
                  <wd-icon v-else name="close" size="28rpx" />
                  <text>{{ activeAction === 'cancel' ? '正在取消' : '取消运单' }}</text>
                </view>
              </wd-button>
              <wd-button
                v-if="isAccepted"
                class="detail-actions__primary"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="uploadPickup"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'pickup'" type="ring" color="#ffffff" size="28rpx" />
                  <wd-icon v-else :name="hasPickupProof ? 'arrow-right' : 'upload'" size="30rpx" />
                  <text>{{ pickupActionLabel }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isLoading"
                class="detail-actions__primary detail-actions__primary--wide"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="confirmDeparture"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'departure'" type="ring" color="#ffffff" size="28rpx" />
                  <wd-icon v-else name="location" size="30rpx" />
                  <text>{{ activeAction === 'departure' ? '正在确认发车' : '确认发车' }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isTransporting"
                class="detail-actions__primary detail-actions__primary--wide"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="confirmArrival"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'arrival'" type="ring" color="#ffffff" size="28rpx" />
                  <wd-icon v-else name="location" size="30rpx" />
                  <text>{{ activeAction === 'arrival' ? '正在确认到达' : '确认到达目的地' }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isUnloading"
                class="detail-actions__primary detail-actions__primary--wide"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="submitSignature"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'signature'" type="ring" color="#ffffff" size="28rpx" />
                  <wd-icon v-else :name="hasDeliveryProof ? 'check-circle' : 'upload'" size="30rpx" />
                  <text>{{ signatureActionLabel }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isSigned"
                class="detail-actions__primary detail-actions__primary--wide"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="complete"
              >
                <view class="detail-actions__button-content">
                  <wd-loading v-if="activeAction === 'complete'" type="ring" color="#ffffff" size="28rpx" />
                  <wd-icon v-else name="check" size="30rpx" />
                  <text>{{ activeAction === 'complete' ? '正在完成运单' : '确认完成运单' }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isCompleted"
                class="detail-actions__receipt"
                type="primary"
                plain
                :round="false"
                @click.stop="viewReceipt"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="view" size="30rpx" />
                  <text>查看运输单据</text>
                </view>
              </wd-button>
            </view>
          </view>
        </TmsRouteCard>

        <view class="info-card card">
          <view class="section-head">
            <view>
              <text class="section-eyebrow">货物档案</text>
              <text class="section-title">货物信息</text>
            </view>
            <text class="section-head__hint">{{ current.cargoName || '运输货物' }}</text>
          </view>
          <view class="info-list">
            <view v-for="row in cargoRows" :key="row.label" class="info-list__row">
              <text>{{ row.label }}</text>
              <text>{{ row.value }}</text>
            </view>
          </view>
        </view>

        <view class="info-card card">
          <view class="section-head">
            <view>
              <text class="section-eyebrow">运输站点</text>
              <text class="section-title">站点与联系人</text>
            </view>
            <text class="section-head__hint">可快捷拨号</text>
          </view>
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
          <view class="section-head">
            <view>
              <text class="section-eyebrow">凭证资料</text>
              <text class="section-title">运输单据</text>
            </view>
            <text class="section-head__hint">{{ waybill.proofs.length }} 份</text>
          </view>
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
      <view v-else class="detail-page__state card">
        <view class="detail-page__state-icon">
          <wd-loading v-if="waybill.loading" type="ring" color="#4f46e5" size="58rpx" />
          <TmsIcon v-else name="document" size="62rpx" />
        </view>
        <text class="detail-page__state-title">
          {{ waybill.loading ? '正在加载任务详情' : '暂时无法显示任务' }}
        </text>
        <text class="detail-page__state-hint">
          {{ waybill.loading ? '正在同步运输节点、货物与站点信息' : '请返回运单列表后重新进入' }}
        </text>
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
        :disabled="actionBusy"
        @click="accept"
      >
        <view class="detail-actions__button-content">
          <wd-loading v-if="activeAction === 'accept'" type="ring" color="#ffffff" size="30rpx" />
          <wd-icon v-else name="check-circle" size="32rpx" />
          <text>{{ activeAction === 'accept' ? '正在接受任务' : '确认接受任务' }}</text>
        </view>
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100vh;
  overflow: hidden;
  background: #f4f6fa;
}

.detail-page__blue {
  color: #fff;
  background: linear-gradient(135deg, #292266 0%, #4f46e5 56%, #2563eb 118%);
}

.detail-page__status {
  margin: 0 28rpx;
  padding: 22rpx 22rpx 28rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.detail-page__status-icon {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.11);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-page__status-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.2;
}

.detail-page__hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  opacity: 0.72;
}

.detail-page__scroll {
  height: calc(100vh - 298rpx);
}

.detail-page__scroll--header-only {
  height: calc(100vh - 176rpx);
}

.detail-page--pending .detail-page__scroll {
  height: calc(100vh - 520rpx - 128rpx - env(safe-area-inset-bottom));
}

.detail-page--pending.detail-page--route-empty .detail-page__scroll {
  height: calc(100vh - 360rpx - 128rpx - env(safe-area-inset-bottom));
}

.detail-page__content {
  padding: 24rpx 28rpx 58rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-page--pending .detail-page__content {
  padding-top: 26rpx;
  padding-bottom: 34rpx;
}

.section-title {
  display: block;
  margin-top: 7rpx;
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.detail-actions {
  margin-top: 32rpx;
  padding-top: 26rpx;
  border-top: 1rpx solid #edf0f5;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-actions__helper {
  min-height: 58rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  color: #4f46e5;
  background: #f3f4ff;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.4;
}

.detail-actions__helper text {
  min-width: 0;
  flex: 1;
}

.detail-actions__helper--success {
  color: #047857;
  background: #ecfdf5;
}

.detail-actions__controls {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.section-head__hint {
  max-width: 260rpx;
  overflow: hidden;
  color: #748096;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-actions__primary,
.detail-actions__outline {
  height: 82rpx;
  min-width: 0;
  padding: 0 24rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
  font-weight: 800;
}

.detail-actions__primary {
  height: 82rpx;
  min-width: 0;
  padding: 0 24rpx;
  border-radius: 16rpx;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  box-shadow: 0 12rpx 24rpx rgba(79, 70, 229, 0.22);
  flex: 1;
  font-size: 26rpx;
  font-weight: 800;
}

.detail-actions__primary--wide {
  width: 100%;
}

.detail-actions__outline {
  flex: 0 0 176rpx;
  color: #dc2626;
  background: #fffafa;
  border: 1rpx solid #fecaca;
  box-shadow: none;
}

.detail-actions__receipt {
  width: 100%;
  height: 80rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 16rpx;
  color: #4b5870;
  background: #f8fafc;
  font-size: 26rpx;
  font-weight: 700;
}

.detail-actions__button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  white-space: nowrap;
}

.detail-actions__button-content text {
  white-space: nowrap;
}

.detail-actions__primary.is-disabled,
.detail-actions__outline.is-disabled,
.pending-footer__button.is-disabled {
  opacity: 0.68;
  box-shadow: none;
}

.info-card,
.proof-card {
  padding: 30rpx;
  border-radius: 24rpx;
}

.info-list {
  margin-top: 22rpx;
  padding-top: 8rpx;
}

.info-list__row {
  min-height: 70rpx;
  border-bottom: 1rpx solid #e8ecf3;
  color: #748096;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  font-size: 26rpx;
}

.info-list__row text:last-child {
  color: #172033;
  font-weight: 700;
  text-align: right;
}

.station-list {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-list__row:last-child {
  border-bottom: 0;
}

.station-list__row {
  min-width: 0;
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 54rpx;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #e8ecf3;
}

.station-list__row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.station-list__label {
  color: #748096;
  font-size: 26rpx;
  line-height: 1.2;
}

.station-list__main {
  min-width: 0;
  color: #172033;
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
  color: #172033;
  font-weight: 800;
  line-height: 1.2;
}

.station-list__address {
  color: #748096;
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
  background: #10b981;
  box-shadow: 0 10rpx 20rpx rgba(16, 185, 129, 0.2);
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
  border-radius: 16rpx;
  background: #f7f9fc;
}

.detail-page__state {
  margin: 38rpx 28rpx;
  min-height: 360rpx;
  padding: 44rpx;
  color: #748096;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  text-align: center;
}

.detail-page__state-icon {
  width: 112rpx;
  height: 112rpx;
  margin-bottom: 8rpx;
  border-radius: 34rpx;
  color: #4f46e5;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-page__state-title {
  color: #172033;
  font-size: 29rpx;
  font-weight: 800;
}

.detail-page__state-hint {
  max-width: 470rpx;
  color: #748096;
  font-size: 23rpx;
  line-height: 1.55;
}

.pending-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  min-height: calc(128rpx + env(safe-area-inset-bottom));
  padding: 22rpx 30rpx calc(22rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid #e8ecf3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 26rpx;
  box-shadow: 0 -12rpx 34rpx rgba(32, 40, 66, 0.09);
}

.pending-footer__label {
  color: #172033;
  font-size: 26rpx;
}

.pending-footer__money {
  color: #4f46e5;
  font-size: 34rpx;
  font-weight: 900;
}

.pending-footer__button {
  flex: 0 0 328rpx;
  height: 86rpx;
  min-width: 0;
  padding: 0;
  border-radius: 16rpx;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  box-shadow: 0 12rpx 22rpx rgba(79, 70, 229, 0.2);
  font-size: 30rpx;
  font-weight: 800;
}

.pending-footer__button :deep(.wd-button__content) {
  gap: 10rpx;
}
</style>
