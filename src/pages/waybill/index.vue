<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import type { WaybillStatusGroup } from '@/api/waybill'
import type { Waybill } from '@/api/types'
import { useWaybillStore } from '@/stores/waybill'
import { openWaybillNavigation } from '@/utils/navigation'

const waybill = useWaybillStore()
const active = ref<WaybillStatusGroup>('all')
const refreshing = ref(false)
const loadingGroup = ref<WaybillStatusGroup | ''>('')
const initialized = ref(false)
const loadError = ref('')
const isBusy = computed(() => waybill.loading || refreshing.value || Boolean(loadingGroup.value))
const showListLoading = computed(() => waybill.loading && waybill.list.length > 0)
const activeLabel = computed(() => tabs.find((item) => item.value === active.value)?.label || '全部')

const tabs: Array<{ label: string; value: WaybillStatusGroup }> = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' }
]

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
    loadError.value = error instanceof Error ? error.message : '运单加载失败'
    uni.showToast({
      title: error instanceof Error ? error.message : '运单加载失败',
      icon: 'none'
    })
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
          type="icon"
          aria-label="刷新运单列表"
          custom-style="width: 62rpx; min-width: 62rpx; height: 62rpx; padding: 0; border-radius: 50%; background: rgba(255,255,255,0.16); color: #fff;"
          :disabled="isBusy"
          @click="refreshList"
        >
          <wd-loading v-if="refreshing || waybill.loading" type="ring" color="#ffffff" size="34rpx" />
          <wd-icon v-else name="refresh" size="38rpx" />
        </wd-button>
      </view>
      <view class="waybill-page__tabs" role="tablist" aria-label="运单状态筛选">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="waybill-page__tab"
          :class="{
            'waybill-page__tab--active': active === tab.value,
            'waybill-page__tab--loading': loadingGroup === tab.value
          }"
          role="tab"
          :aria-selected="active === tab.value"
          :disabled="isBusy && active !== tab.value"
          hover-class="waybill-page__tab--pressed"
          @tap="switchGroup(tab.value)"
        >
          <view v-if="loadingGroup === tab.value" class="waybill-page__tab-spinner" />
          {{ tab.label }}
        </button>
      </view>
    </view>

    <scroll-view scroll-y class="waybill-page__list">
      <TmsPageSkeleton
        v-if="!initialized || (loadError && !waybill.list.length)"
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
              <wd-icon name="add-circle" size="26rpx" />
              <text>费用上报</text>
            </button>
          </view>
        </TmsRouteCard>
      </view>
      <view v-else class="waybill-page__empty card">
        <view class="waybill-page__empty-icon">
          <wd-loading v-if="waybill.loading" type="ring" color="#4f46e5" size="54rpx" />
          <TmsIcon v-else name="waybill" size="62rpx" />
        </view>
        <text class="waybill-page__empty-title">
          {{ waybill.loading ? '正在同步运输任务' : '当前筛选下暂无任务' }}
        </text>
        <text class="waybill-page__empty-hint">
          {{ waybill.loading ? '请稍候，正在获取最新运单数据' : '可切换任务状态，或确认后台订单已绑定当前司机' }}
        </text>
        <wd-button v-if="!waybill.loading" class="waybill-page__empty-action" type="text" @click="refreshList">
          重新同步
        </wd-button>
      </view>
      <view v-if="showListLoading" class="waybill-page__list-loading">
        <wd-loading type="ring" color="#3763f4" size="32rpx" />
        <text>正在加载</text>
      </view>
    </scroll-view>

    <TmsBottomNav active="waybill" />
  </view>
</template>

<style scoped lang="scss">
.waybill-page {
  height: 100vh;
  height: 100dvh;
  padding-bottom: 0;
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
  font-weight: 800;
  line-height: 1.12;
}

.waybill-page__eyebrow {
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.2;
  opacity: 0.76;
}

.waybill-page__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.2;
  opacity: 0.82;
}

.waybill-page__refresh {
  position: relative;
  z-index: 1;
  flex: 0 0 62rpx;
  width: 62rpx;
  height: 62rpx;
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
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.waybill-page__tab {
  min-width: 0;
  height: 72rpx;
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
  font-size: 26rpx;
  font-weight: 700;
}

.waybill-page__tab::after {
  border: 0;
}

.waybill-page__tab--pressed {
  background: #f4f5ff;
}

.waybill-page__tab--active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #4f46e5, #3b67df);
  box-shadow: 0 10rpx 22rpx rgba(79, 70, 229, 0.2);
}

.waybill-page__tab--loading {
  pointer-events: none;
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
  position: absolute;
  left: 54rpx;
  right: 54rpx;
  top: 28rpx;
  z-index: 2;
  height: 68rpx;
  border-radius: 12rpx;
  color: #4f46e5;
  background: rgba(255, 255, 255, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 24rpx rgba(40, 45, 54, 0.05);
  pointer-events: none;
}

@keyframes waybill-spin {
  to {
    transform: rotate(360deg);
  }
}

.waybill-page__stack {
  padding: 24rpx 28rpx 184rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.waybill-page__list-head {
  padding: 2rpx 4rpx 4rpx;
  color: #748096;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  font-size: 21rpx;
}

.waybill-page__list-head > view {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.waybill-page__list-head > view text:first-child {
  color: #172033;
  font-size: 27rpx;
  font-weight: 800;
}

.waybill-expense-action {
  min-height: 76rpx;
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
  font-size: 22rpx;
  font-weight: 700;
}

.waybill-expense-action > view small {
  margin-top: 3rpx;
  color: #98a2b3;
  font-size: 19rpx;
}

.waybill-expense-action button {
  flex: 0 0 auto;
  min-height: 64rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.25);
  border-radius: 999rpx;
  color: var(--tms-primary);
  background: #f6f7ff;
  display: flex;
  align-items: center;
  gap: 7rpx;
  font-size: 22rpx;
  font-weight: 800;
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
  font-weight: 800;
}

.waybill-page__empty-hint {
  padding: 0 38rpx;
  color: #9aa5b7;
  font-size: 24rpx;
  line-height: 1.5;
}

.waybill-page__empty-action {
  min-width: 0;
  margin-top: 8rpx;
  padding: 0 20rpx;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 700;
}
</style>
