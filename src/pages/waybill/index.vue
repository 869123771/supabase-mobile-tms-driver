<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import type { WaybillStatusGroup } from '@/api/waybill'
import { useWaybillStore } from '@/stores/waybill'

const waybill = useWaybillStore()
const active = ref<WaybillStatusGroup>('all')

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
  await load()
  uni.stopPullDownRefresh()
})

async function load() {
  try {
    await waybill.loadList(active.value)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '运单加载失败',
      icon: 'none'
    })
  }
}

async function switchGroup(value: WaybillStatusGroup) {
  active.value = value
  await load()
}

function openDetail(id: string) {
  uni.navigateTo({ url: `/pages/waybill/detail?id=${id}` })
}

function navigate() {
  uni.showToast({ title: '已为你打开导航意图', icon: 'none' })
}
</script>

<template>
  <view class="waybill-page page safe-bottom">
    <view class="waybill-page__header">
      <view class="waybill-page__title-row">
        <text>运输任务</text>
        <button hover-class="none">
          <wd-icon name="menu" size="42rpx" />
        </button>
      </view>
      <view class="waybill-page__tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="waybill-page__tab"
          :class="{ 'waybill-page__tab--active': active === tab.value }"
          @tap="switchGroup(tab.value)"
        >
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
        <wd-icon name="list" size="72rpx" />
        <text>{{ waybill.loading ? '正在加载运单' : '暂无运单' }}</text>
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
}

.waybill-page__title-row {
  height: 184rpx;
  padding: calc(56rpx + env(safe-area-inset-top)) 32rpx 26rpx;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.waybill-page__title-row text {
  font-size: 36rpx;
  font-weight: 800;
}

.waybill-page__title-row button {
  width: 62rpx;
  height: 62rpx;
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
  gap: 16rpx;
}

.waybill-page__tab {
  height: 64rpx;
  border-radius: 999rpx;
  color: #505867;
  background: #f7f8fb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
}

.waybill-page__tab--active {
  color: #fff;
  background: var(--tms-primary);
}

.waybill-page__list {
  height: calc(100vh - 252rpx);
}

.waybill-page__stack {
  padding: 24rpx 30rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.waybill-page__empty {
  margin: 48rpx 30rpx;
  min-height: 280rpx;
  color: var(--tms-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  font-size: 28rpx;
}
</style>
