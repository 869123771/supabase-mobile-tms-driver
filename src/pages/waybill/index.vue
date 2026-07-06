<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import type { WaybillStatusGroup } from '@/api/waybill'
import type { Waybill } from '@/api/types'
import { useWaybillStore } from '@/stores/waybill'
import { openWaybillNavigation } from '@/utils/navigation'

const waybill = useWaybillStore()
const active = ref<WaybillStatusGroup>('all')
const refreshing = ref(false)
const loadingGroup = ref<WaybillStatusGroup | ''>('')
const isBusy = computed(() => waybill.loading || refreshing.value || Boolean(loadingGroup.value))
const showListLoading = computed(() => waybill.loading && waybill.list.length > 0)

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
  try {
    await waybill.loadList(group)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '运单加载失败',
      icon: 'none'
    })
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

function navigate(item: Waybill) {
  openWaybillNavigation(item)
}
</script>

<template>
  <view class="waybill-page page safe-bottom">
    <view class="waybill-page__header">
      <view class="waybill-page__title-row">
        <view>
          <text class="waybill-page__title">运输任务</text>
          <text class="waybill-page__subtitle">与后台订单列表同步</text>
        </view>
        <button
          class="waybill-page__refresh"
          hover-class="none"
          :loading="refreshing || waybill.loading"
          :disabled="isBusy"
          @tap="refreshList"
        >
          <TmsIcon v-if="!refreshing && !waybill.loading" name="refresh" size="38rpx" />
        </button>
      </view>
      <view class="waybill-page__tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="waybill-page__tab"
          :class="{
            'waybill-page__tab--active': active === tab.value,
            'waybill-page__tab--loading': loadingGroup === tab.value
          }"
          @tap="switchGroup(tab.value)"
        >
          <view v-if="loadingGroup === tab.value" class="waybill-page__tab-spinner" />
          {{ tab.label }}
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="waybill-page__list">
      <view v-if="waybill.list.length" class="waybill-page__stack">
        <TmsRouteCard
          v-for="item in waybill.list"
          :key="item.id"
          :waybill="item"
          @open="openDetail(item.id)"
          @navigate="navigate"
        />
      </view>
      <view v-else class="waybill-page__empty card">
        <TmsIcon name="waybill" size="72rpx" />
        <text>{{ waybill.loading ? '正在加载运单' : '当前账号暂无匹配运单' }}</text>
        <text v-if="!waybill.loading" class="waybill-page__empty-hint">
          请确认后台订单已绑定到该司机档案
        </text>
      </view>
      <view v-if="showListLoading" class="waybill-page__list-loading">
        <view class="waybill-page__spinner" />
        <text>正在加载</text>
      </view>
    </scroll-view>

    <TmsBottomNav active="waybill" />
  </view>
</template>

<style scoped lang="scss">
.waybill-page {
  padding-bottom: 150rpx;
}

.waybill-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  box-shadow: 0 6rpx 20rpx rgba(40, 45, 54, 0.04);
}

.waybill-page__title-row {
  height: 184rpx;
  padding: calc(56rpx + env(safe-area-inset-top)) 30rpx 24rpx;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.waybill-page__title {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
}

.waybill-page__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  font-weight: 600;
  opacity: 0.82;
}

.waybill-page__refresh {
  flex: 0 0 62rpx;
  width: 62rpx;
  height: 62rpx;
  margin: 0 0 0 auto;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}

.waybill-page__tabs {
  padding: 16rpx 30rpx 18rpx;
  background: #fff;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.waybill-page__tab {
  height: 64rpx;
  border-radius: 999rpx;
  color: #505867;
  background: #f7f8fb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.waybill-page__tab--active {
  color: #fff;
  background: var(--tms-primary);
}

.waybill-page__tab--loading {
  pointer-events: none;
}

.waybill-page__tab-spinner,
.waybill-page__spinner {
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
  height: calc(100vh - 252rpx);
}

.waybill-page__list-loading {
  position: absolute;
  left: 30rpx;
  right: 30rpx;
  top: 24rpx;
  z-index: 2;
  height: 92rpx;
  border-radius: 12rpx;
  color: var(--tms-primary);
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  font-size: 26rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 24rpx rgba(40, 45, 54, 0.06);
  pointer-events: none;
}

.waybill-page__spinner {
  width: 30rpx;
  height: 30rpx;
  border-width: 4rpx;
  border-color: #dbe4ff;
  border-top-color: var(--tms-primary);
}

@keyframes waybill-spin {
  to {
    transform: rotate(360deg);
  }
}

.waybill-page__stack {
  padding: 24rpx 30rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.waybill-page__empty {
  margin: 48rpx 30rpx;
  min-height: 300rpx;
  color: var(--tms-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  font-size: 28rpx;
  text-align: center;
}

.waybill-page__empty-hint {
  padding: 0 38rpx;
  color: var(--tms-light);
  font-size: 24rpx;
  line-height: 1.5;
}
</style>
