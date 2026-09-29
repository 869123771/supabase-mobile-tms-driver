<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import type { WaybillStatusGroup } from '@/api/waybill'
import type { Waybill } from '@/api/types'
import { getUserFacingErrorMessage } from '@/api/supabase'
import { useWaybillStore } from '@/stores/waybill'
import { openWaybillNavigation } from '@/utils/navigation'

const waybill = useWaybillStore()
const active = ref<WaybillStatusGroup>('all')
const refreshing = ref(false)
const loadingGroup = ref<WaybillStatusGroup | ''>('')
const initialized = ref(false)
const loadError = ref('')
const isBusy = computed(() => waybill.loading || refreshing.value || Boolean(loadingGroup.value))
const showListLoading = computed(
  () => initialized.value && !loadingGroup.value && waybill.loading && waybill.list.length > 0
)
const activeLabel = computed(() => tabs.find((item) => item.value === active.value)?.label || '全部')

const tabs: Array<{ label: string; value: WaybillStatusGroup }> = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' }
]
const segmentOptions = computed(() => tabs.map((tab) => ({
  value: tab.value,
  disabled: isBusy.value && active.value !== tab.value,
  payload: { label: tab.label }
})))

onLoad((query) => {
  if (query?.group === 'completed') active.value = 'completed'
})

onShow(() => {
  void load()
})

onPullDownRefresh(async () => {
  await refreshList()
  uni.stopPullDownRefresh()
})

async function load(group: WaybillStatusGroup = active.value) {
  loadError.value = ''
  try {
    await waybill.loadList(group)
  } catch (error) {
    loadError.value = getUserFacingErrorMessage(error, '运单加载失败，请重试')
  } finally {
    initialized.value = true
  }
}

async function refreshList() {
  if (isBusy.value) return
  refreshing.value = true
  try {
    await load(active.value)
  } finally {
    refreshing.value = false
  }
}

async function switchGroup(value: WaybillStatusGroup) {
  if (isBusy.value || value === active.value) return
  active.value = value
  loadingGroup.value = value
  try {
    await load(value)
  } finally {
    loadingGroup.value = ''
  }
}

function onSegmentChange(option: { value: string | number }) {
  void switchGroup(option.value as WaybillStatusGroup)
}

function openDetail(id: string) {
  uni.navigateTo({ url: `/pages/waybill/detail?id=${id}` })
}

function canReportExpense(item: Waybill) {
  return ['accepted', 'loading', 'transporting', 'unloading', 'signed', 'completed'].includes(
    item.status
  )
}

function openExpense(id: string) {
  uni.navigateTo({ url: `/pages/waybill/expense?id=${encodeURIComponent(id)}&create=1` })
}

function navigate(item: Waybill) {
  openWaybillNavigation(item)
}
</script>

<template>
  <view class="waybill-page page safe-bottom">
    <view class="waybill-page__header">
      <view class="waybill-page__title-row">
        <view class="waybill-page__header-glow" />
        <view class="waybill-page__title-main">
          <text class="waybill-page__eyebrow">任务中心</text>
          <text class="waybill-page__title">运输任务</text>
          <text class="waybill-page__subtitle">聚焦当前节点，按顺序完成每项运输任务</text>
        </view>
        <wd-button
          class="waybill-page__refresh"
          aria-label="刷新运单列表"
          custom-style="width: 88rpx; min-width: 44px; height: 88rpx; min-height: 44px; padding: 0; border-radius: 50%; background: rgba(255,255,255,0.16); color: #fff;"
          :disabled="isBusy"
          @click="refreshList"
        >
          <wd-loading v-if="refreshing || waybill.loading" type="circular" color="#ffffff" size="34rpx" />
          <TmsIcon v-else name="refresh" size="38rpx" />
        </wd-button>
      </view>
      <wd-segmented
        :value="active"
        :options="segmentOptions"
        theme="outline"
        custom-class="waybill-page__tabs"
        role="tablist"
        aria-label="运单状态筛选"
        @change="onSegmentChange"
      >
        <template #label="{ option }">
          <view
            class="waybill-page__tab"
            role="tab"
            :aria-selected="active === option.value"
            :aria-disabled="isBusy && active !== option.value"
            tabindex="0"
            @keydown.enter="switchGroup(option.value)"
            @keydown.space.prevent="switchGroup(option.value)"
          >
            <view v-if="loadingGroup === option.value" class="waybill-page__tab-spinner" />
            {{ option.payload.label }}
          </view>
        </template>
      </wd-segmented>
    </view>

    <scroll-view scroll-y class="waybill-page__list">
      <view v-if="loadError && waybill.list.length" class="waybill-page__sync-error" role="alert">
        <TmsIcon name="refresh" size="30rpx" />
        <text>同步失败，当前显示上次的任务列表</text>
        <button @tap="refreshList">重试</button>
      </view>
      <view v-if="showListLoading" class="waybill-page__list-loading" role="status">
        <wd-loading type="circular" color="#3763f4" size="32rpx" />
        <text>正在更新任务…</text>
      </view>
      <TmsPageSkeleton
        v-if="!initialized || loadingGroup || (loadError && !waybill.list.length)"
        compact
        label="正在同步运输任务…"
        :error="loadError"
        @retry="load(active)"
      />
      <view v-else-if="waybill.list.length" class="waybill-page__stack">
        <view class="waybill-page__list-head">
          <view>
            <text>{{ activeLabel }}任务</text>
            <text>共 {{ waybill.list.length }} 项</text>
          </view>
          <text>下拉可刷新</text>
        </view>
        <TmsRouteCard
          v-for="item in waybill.list"
          :key="item.id"
          :waybill="item"
          variant="list"
          @open="openDetail(item.id)"
          @navigate="navigate"
        >
          <view
            v-if="canReportExpense(item)"
            class="waybill-expense-action"
            @tap.stop
          >
            <view>
              <text>途中产生垫付费用？</text>
              <small>上传票据后同步财务审批</small>
            </view>
            <button
              :aria-label="`上报运单 ${item.waybillNo} 的费用`"
              hover-class="waybill-expense-action__button--pressed"
              @tap.stop="openExpense(item.id)"
            >
              <TmsIcon name="expense" size="26rpx" />
              <text>费用上报</text>
            </button>
          </view>
        </TmsRouteCard>
      </view>
      <view v-else class="waybill-page__empty card">
        <view class="waybill-page__empty-icon">
          <wd-loading v-if="waybill.loading" type="circular" color="#4f46e5" size="54rpx" />
          <TmsIcon v-else name="waybill" size="62rpx" />
        </view>
        <text class="waybill-page__empty-title">
          {{ waybill.loading ? '正在同步运输任务' : '当前筛选下暂无任务' }}
        </text>
        <text class="waybill-page__empty-hint">
          {{ waybill.loading ? '请稍候，正在获取最新运单数据' : '可切换任务状态，或确认后台订单已绑定当前司机' }}
        </text>
        <wd-button v-if="!waybill.loading" class="waybill-page__empty-action" variant="text" @click="refreshList">
          重新同步
        </wd-button>
      </view>
    </scroll-view>

    <TmsBottomNav active="waybill" />
  </view>
</template>

<style scoped lang="scss">
.waybill-page {
  height: 100vh;
  height: 100dvh;
  padding-bottom: var(--tms-tabbar-space);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.waybill-page__header {
  position: sticky;
  flex: 0 0 auto;
  top: 0;
  z-index: 10;
  background: #fff;
  box-shadow: 0 12rpx 34rpx rgba(32, 40, 66, 0.09);
}

.waybill-page__title-row {
  position: relative;
  min-height: 190rpx;
  padding: calc(42rpx + env(safe-area-inset-top)) 32rpx 30rpx;
  color: #fff;
  overflow: hidden;
  background: var(--tms-hero-gradient);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.waybill-page__title-row::after {
  position: absolute;
  right: -120rpx;
  top: -170rpx;
  width: 400rpx;
  height: 400rpx;
  content: '';
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  box-shadow: 0 0 0 66rpx rgba(255, 255, 255, 0.025);
}

.waybill-page__header-glow {
  position: absolute;
  left: 42%;
  bottom: -160rpx;
  width: 440rpx;
  height: 260rpx;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.2);
  filter: blur(72rpx);
}

.waybill-page__title-main {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.waybill-page__title {
  display: block;
  margin-top: 7rpx;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.12;
}

.waybill-page__eyebrow {
  font-size: max(20rpx, 12px);
  font-weight: 600;
  line-height: 1.2;
  opacity: 0.76;
}

.waybill-page__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: max(23rpx, 12px);
  font-weight: 600;
  line-height: 1.2;
  opacity: 0.82;
}

.waybill-page__refresh {
  position: relative;
  z-index: 1;
  flex: 0 0 88rpx;
  width: 88rpx;
  height: 88rpx;
  margin: 0 0 0 auto;
  padding: 0;
  min-width: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}

.waybill-page__refresh.is-disabled {
  opacity: 0.78;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
}

.waybill-page__tabs {
  padding: 18rpx 28rpx 20rpx;
  background: rgba(255, 255, 255, 0.96);
  gap: 12rpx;
  border-radius: 0;
}

:deep(.waybill-page__tabs)::before {
  display: none;
}

:deep(.waybill-page__tabs .wd-segmented__item) {
  min-width: 0;
  height: var(--tms-control-height);
  margin: 0;
  padding: 0 10rpx;
  border-radius: 999rpx;
  color: #505867;
  border: 1rpx solid #edf0f5;
  background: #f5f7fb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: max(26rpx, 12px);
  font-weight: 700;
}

:deep(.waybill-page__tabs .wd-segmented__item + .wd-segmented__item) {
  border-left: 0;
}

:deep(.waybill-page__tabs .wd-segmented__item-label) {
  width: 100%;
}

.waybill-page__tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  width: 100%;
  min-height: var(--tms-control-height);
}

.waybill-page__tab:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -4px;
  border-radius: 999rpx;
}

:deep(.waybill-page__tabs .wd-segmented__item.is-active) {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #4f46e5, #3b67df);
  box-shadow: 0 10rpx 22rpx rgba(79, 70, 229, 0.2);
}

:deep(.waybill-page__tabs .wd-segmented__item.is-disabled) {
  opacity: 0.68;
}

.waybill-page__tab-spinner {
  border-style: solid;
  border-radius: 50%;
  animation: waybill-spin 0.8s linear infinite;
}

.waybill-page__tab-spinner {
  width: 22rpx;
  height: 22rpx;
  border-width: 3rpx;
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
}

.waybill-page__list {
  position: relative;
  min-height: 0;
  height: auto;
  flex: 1;
}

.waybill-page__list-loading {
  min-height: 68rpx;
  margin: 18rpx 28rpx 0;
  border-radius: 16rpx;
  color: #4f46e5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: max(24rpx, 12px);
  font-weight: 700;
  box-shadow: var(--tms-shadow-sm);
  pointer-events: none;
}

.waybill-page__sync-error {
  min-height: 76rpx;
  margin: 18rpx 28rpx 0;
  padding: 12rpx 16rpx 12rpx 22rpx;
  border: 1rpx solid #fed7aa;
  border-radius: 16rpx;
  color: #9a5a0d;
  background: #fff8ed;
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: max(23rpx, 12px);
  font-weight: 600;
}

.waybill-page__sync-error text {
  min-width: 0;
  flex: 1;
  line-height: 1.35;
}

.waybill-page__sync-error button {
  flex: 0 0 auto;
  min-width: 88rpx;
  min-height: 64rpx;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 12rpx;
  color: #9a5a0d;
  background: #ffedd5;
  font-size: max(23rpx, 12px);
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes waybill-spin {
  to {
    transform: rotate(360deg);
  }
}

.waybill-page__stack {
  padding: 24rpx 28rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.waybill-page__list-head {
  padding: 2rpx 4rpx 4rpx;
  color: #748096;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  font-size: max(21rpx, 12px);
}

.waybill-page__list-head > view {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.waybill-page__list-head text {
  line-height: 1.25;
}

.waybill-page__list-head > view text:first-child {
  color: #172033;
  font-size: max(27rpx, 12px);
  font-weight: 700;
}

.waybill-expense-action {
  min-height: 88rpx;
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf0f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.waybill-expense-action > view {
  min-width: 0;
  flex: 1;
}

.waybill-expense-action > view text,
.waybill-expense-action > view small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waybill-expense-action > view text {
  color: #344054;
  font-size: max(22rpx, 12px);
  font-weight: 700;
}

.waybill-expense-action > view small {
  margin-top: 3rpx;
  color: #98a2b3;
  font-size: max(19rpx, 12px);
}

.waybill-expense-action button {
  flex: 0 0 auto;
  min-height: var(--tms-control-height);
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.25);
  border-radius: 999rpx;
  color: var(--tms-primary);
  background: #f6f7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  font-size: max(22rpx, 12px);
  font-weight: 700;
  line-height: 1;
  touch-action: manipulation;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.waybill-expense-action button::after {
  border: 0;
}

.waybill-expense-action__button--pressed,
.waybill-expense-action button:active {
  color: #3730a3;
  background: #eceeff;
  transform: scale(0.97);
}

.waybill-expense-action button:focus-visible {
  outline: 4rpx solid rgba(79, 70, 229, 0.22);
  outline-offset: 3rpx;
}

.waybill-page__empty {
  margin: 48rpx 28rpx;
  min-height: 360rpx;
  padding: 44rpx 36rpx;
  color: #748096;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  text-align: center;
}

.waybill-page__empty-icon {
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

.waybill-page__empty-title {
  color: #172033;
  font-size: 29rpx;
  font-weight: 700;
}

.waybill-page__empty-hint {
  padding: 0 38rpx;
  color: #9aa5b7;
  font-size: max(24rpx, 12px);
  line-height: 1.5;
}

.waybill-page__empty-action {
  min-width: 0;
  margin-top: 8rpx;
  padding: 0 20rpx;
  color: #4f46e5;
  font-size: max(24rpx, 12px);
  font-weight: 700;
}
</style>
