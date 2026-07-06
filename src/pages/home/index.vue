<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import { useProfileStore } from '@/stores/profile'
import { useWaybillStore } from '@/stores/waybill'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { chooseImages } from '@/utils/file'
import { formatKm } from '@/utils/format'
import { openWaybillNavigation } from '@/utils/navigation'
import type { Waybill } from '@/api/types'

const profile = useProfileStore()
const waybill = useWaybillStore()
const refreshing = ref(false)

const driver = computed(() => profile.driver)
const vehicle = computed(() => profile.vehicle)
const carrier = computed(() => profile.carrier)
const task = computed(() => waybill.currentTask)
const todoList = computed(() =>
  waybill.list.filter((item) => item.id !== task.value?.id).slice(0, 3)
)

const vehicleMetrics = computed(() => [
  { label: '今日里程', value: task.value?.remainingDistanceKm || 86.5, unit: 'km' },
  { label: '运输次数', value: Math.max(profile.summary?.completedCount || 0, 8), unit: '次' },
  { label: '燃油', value: 65, unit: '%' }
])

const taskButtonText = computed(() => {
  const status = task.value?.status
  if (status === 'pending') return '接受任务'
  if (status === 'accepted' || status === 'loading') return '上传提货照片'
  if (status === 'transporting') return '确认到达'
  if (status === 'unloading') return '完成卸货'
  return '查看详情'
})

onShow(() => {
  void refresh()
})

async function refresh() {
  refreshing.value = true
  try {
    await profile.load(true)
    await waybill.loadHomeTask()
    await waybill.loadList('all')
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '数据加载失败',
      icon: 'none'
    })
  } finally {
    refreshing.value = false
  }
}

function openDetail(id?: string) {
  if (!id) return
  uni.navigateTo({ url: `/pages/waybill/detail?id=${id}` })
}

function openWaybillList() {
  uni.reLaunch({ url: '/pages/waybill/index' })
}

function navigate(item?: Waybill) {
  openWaybillNavigation(item || task.value)
}

async function handleTaskAction() {
  if (!task.value) return
  try {
    await waybill.loadDetail(task.value.id)
    if (task.value.status === 'pending') {
      await waybill.acceptCurrent()
    } else if (task.value.status === 'accepted' || task.value.status === 'loading') {
      const files = await chooseImages(3)
      if (files.length === 0) return
      await waybill.uploadPickup(files)
    } else if (task.value.status === 'transporting') {
      await waybill.confirmArrival()
    } else if (task.value.status === 'unloading') {
      const files = await chooseImages(3)
      await waybill.completeCurrent(files)
    } else {
      openDetail(task.value.id)
      return
    }
    uni.showToast({ title: '操作成功', icon: 'success' })
    await refresh()
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
      icon: 'none'
    })
  }
}
</script>

<template>
  <view class="home-page page safe-bottom">
    <view class="home-page__hero">
      <view class="home-page__top">
        <view>
          <text class="home-page__welcome">欢迎您，{{ driver?.driverName || '司机师傅' }}</text>
          <text class="home-page__company">{{ carrier?.companyName || '物流运输有限公司' }}</text>
        </view>
        <button class="home-page__settings" hover-class="none" :disabled="refreshing">
          <TmsIcon name="settings" size="42rpx" />
        </button>
      </view>
    </view>

    <view class="home-page__content">
      <view class="vehicle-card card">
        <view class="vehicle-card__title-row">
          <text class="section-title">车辆状态</text>
          <text class="vehicle-card__normal">正常</text>
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
              {{ vehicle?.vehicleType || '重型货车' }} · 载重{{
                vehicle?.approvedLoadMass || 15
              }}吨
            </text>
          </view>
        </view>
        <TmsMetricGrid :items="vehicleMetrics" />
      </view>

      <view v-if="task" class="task-card">
        <view class="task-card__title-row">
          <text class="section-title">当前任务</text>
          <text class="task-card__distance">剩余距离：{{ formatKm(task.remainingDistanceKm) }}</text>
        </view>
        <TmsRouteCard
          :waybill="task"
          show-progress
          @open="openDetail(task.id)"
          @navigate="navigate"
        >
          <button
            class="task-card__button"
            hover-class="none"
            :loading="waybill.actionLoading"
            @tap.stop="handleTaskAction"
          >
            <TmsIcon name="check" size="36rpx" />
            <text>{{ taskButtonText }}</text>
          </button>
        </TmsRouteCard>
      </view>

      <view v-else class="empty-card card">
        <text class="section-title">当前任务</text>
        <text class="empty-card__text">暂无待执行运单</text>
      </view>

      <view v-if="todoList.length" class="todo-card card">
        <view class="todo-card__title-row">
          <text class="section-title">待办运单</text>
          <text class="todo-card__all" @tap="openWaybillList">全部</text>
        </view>
        <view class="todo-card__stack">
          <TmsRouteCard
            v-for="item in todoList"
            :key="item.id"
            :waybill="item"
            @open="openDetail(item.id)"
            @navigate="navigate"
          />
        </view>
      </view>
      <view v-if="refreshing" class="home-page__loading">
        <view class="home-page__spinner" />
        <text>正在刷新</text>
      </view>
    </view>

    <TmsBottomNav active="home" />
  </view>
</template>

<style scoped lang="scss">
.home-page {
  padding-bottom: 178rpx;
}

.home-page__hero {
  height: 414rpx;
  padding: calc(48rpx + env(safe-area-inset-top)) 56rpx 126rpx;
  color: #fff;
  background: var(--tms-primary);
  border-bottom-left-radius: 58% 72rpx;
  border-bottom-right-radius: 58% 72rpx;
}

.home-page__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 28rpx;
}

.home-page__welcome {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.25;
}

.home-page__company {
  display: inline-flex;
  margin-top: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 23rpx;
  font-weight: 700;
}

.home-page__settings {
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

.home-page__content {
  position: relative;
  margin-top: -142rpx;
  padding: 0 32rpx;
}

.home-page__loading {
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 96rpx;
  border-radius: 12rpx;
  color: var(--tms-primary);
  background: rgba(255, 255, 255, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  font-size: 26rpx;
  font-weight: 700;
  pointer-events: none;
  box-shadow: 0 8rpx 24rpx rgba(40, 45, 54, 0.06);
}

.home-page__spinner {
  width: 30rpx;
  height: 30rpx;
  border: 4rpx solid #dbe4ff;
  border-top-color: var(--tms-primary);
  border-radius: 50%;
  animation: home-spin 0.8s linear infinite;
}

@keyframes home-spin {
  to {
    transform: rotate(360deg);
  }
}

.vehicle-card,
.empty-card {
  padding: 30rpx;
}

.vehicle-card__title-row,
.task-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.section-title {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__normal {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  color: var(--tms-green);
  background: #e9f9f1;
  font-size: 25rpx;
  font-weight: 700;
}

.vehicle-card__body {
  margin: 28rpx 0 26rpx;
  display: flex;
  align-items: center;
  gap: 26rpx;
}

.vehicle-card__image {
  width: 100rpx;
  height: 86rpx;
  border-radius: 8rpx;
  background: var(--tms-panel);
}

.vehicle-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.vehicle-card__plate {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__model {
  color: var(--tms-light);
  font-size: 25rpx;
}

.task-card {
  margin-top: 22rpx;
}

.task-card__title-row {
  padding: 30rpx 30rpx 18rpx;
  margin-top: 22rpx;
  border-radius: 16rpx 16rpx 0 0;
  background: #fff;
}

.task-card :deep(.route-card) {
  border-radius: 0 0 16rpx 16rpx;
}

.task-card__distance {
  color: var(--tms-muted);
  font-size: 24rpx;
}

.task-card__button {
  margin-top: 32rpx;
  width: 100%;
  height: 88rpx;
  padding: 0;
  border-radius: 12rpx;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.empty-card {
  margin-top: 24rpx;
}

.empty-card__text {
  display: block;
  margin-top: 32rpx;
  color: var(--tms-muted);
  font-size: 28rpx;
}

.todo-card {
  margin: 24rpx 0 34rpx;
  padding: 26rpx;
}

.todo-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.todo-card__all {
  color: var(--tms-muted);
  font-size: 25rpx;
}

.todo-card__stack {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>
