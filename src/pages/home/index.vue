<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import { useProfileStore } from '@/stores/profile'
import { useWaybillStore } from '@/stores/waybill'
import { useDictionaryStore } from '@/stores/dictionary'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { chooseImages } from '@/utils/file'
import { getRouteDistanceKm } from '@/utils/route'
import { openWaybillNavigation } from '@/utils/navigation'
import type { Waybill } from '@/api/types'

const profile = useProfileStore()
const waybill = useWaybillStore()
const dictionary = useDictionaryStore()
const refreshing = ref(false)

const driver = computed(() => profile.driver)
const vehicle = computed(() => profile.vehicle)
const carrier = computed(() => profile.carrier)
const task = computed(() => waybill.currentTask)
const todoList = computed(() => {
  const candidates = waybill.list.filter((item) => item.id !== task.value?.id)
  const pending = candidates.filter((item) => item.status === 'pending')
  const supplements = candidates.filter((item) => item.status !== 'pending')
  return [...pending, ...supplements].slice(0, 3)
})
const routeDistanceKm = computed(() => getRouteDistanceKm(task.value))
const vehicleTypeLabel = computed(() => dictionary.label('vehicleType', vehicle.value?.vehicleType))
const fuelTypeLabel = computed(() => dictionary.label('vehicleFuelType', vehicle.value?.fuelType))

const vehicleMetrics = computed(() => [
  {
    label: '当前里程',
    value: routeDistanceKm.value === undefined ? '--' : Number(routeDistanceKm.value).toFixed(1),
    unit: routeDistanceKm.value === undefined ? '' : 'km'
  },
  { label: '运输次数', value: profile.summary?.completedCount ?? 0, unit: '次' },
  { label: '燃料', value: fuelTypeLabel.value, unit: '' }
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
  <view class="home-page page">
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

    <scroll-view scroll-y class="home-page__scroll">
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
                {{ vehicleTypeLabel }} · 载重{{ vehicle?.approvedLoadMass || '--' }}吨
              </text>
            </view>
          </view>
          <TmsMetricGrid :items="vehicleMetrics" />
        </view>

        <view v-if="task" class="task-card">
          <TmsRouteCard
            :waybill="task"
            variant="task"
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
            <text class="section-title">待处理运单</text>
            <view class="todo-card__all" @tap="openWaybillList">
              <text>全部</text>
              <TmsIcon name="arrow-right" size="26rpx" />
            </view>
          </view>
          <view class="todo-card__stack">
            <TmsRouteCard
              v-for="item in todoList"
              :key="item.id"
              :waybill="item"
              variant="compact"
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
    </scroll-view>

    <TmsBottomNav active="home" />
  </view>
</template>

<style scoped lang="scss">
.home-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: var(--tms-bg);
}

.home-page__hero {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 0;
  height: 482rpx;
  padding: calc(60rpx + env(safe-area-inset-top)) 56rpx 126rpx;
  color: #fff;
  background: var(--tms-primary);
  border-bottom-left-radius: 58% 92rpx;
  border-bottom-right-radius: 58% 92rpx;
}

.home-page__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 28rpx;
}

.home-page__welcome {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.25;
}

.home-page__company {
  display: inline-flex;
  margin-top: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 22rpx;
  font-weight: 600;
}

.home-page__settings {
  flex: 0 0 62rpx;
  width: 62rpx;
  height: 62rpx;
  margin: 0 0 0 auto;
  padding: 0;
  border-radius: 0;
  color: #fff;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-page__scroll {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  top: 270rpx;
  bottom: calc(132rpx + env(safe-area-inset-bottom));
}

.home-page__content {
  position: relative;
  padding: 0 26rpx 148rpx;
}

.home-page__loading {
  position: fixed;
  left: 26rpx;
  right: 26rpx;
  top: calc(286rpx + env(safe-area-inset-top));
  z-index: 4;
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
  padding: 28rpx;
  border-radius: 16rpx;
}

.vehicle-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.section-title {
  color: var(--tms-text);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.25;
}

.vehicle-card__normal {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  color: var(--tms-green);
  background: #e9f9f1;
  font-size: 24rpx;
  font-weight: 600;
}

.vehicle-card__body {
  margin: 26rpx 0 24rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.vehicle-card__image {
  width: 96rpx;
  height: 82rpx;
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
  font-size: 30rpx;
  font-weight: 700;
}

.vehicle-card__model {
  color: var(--tms-light);
  font-size: 23rpx;
}

.task-card {
  margin-top: 22rpx;
}

.task-card__button {
  margin-top: 30rpx;
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
  font-weight: 700;
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
  padding: 28rpx;
  border-radius: 16rpx;
}

.todo-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.todo-card__all {
  color: var(--tms-muted);
  display: inline-flex;
  align-items: center;
  gap: 2rpx;
  font-size: 24rpx;
}

.todo-card__stack {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
