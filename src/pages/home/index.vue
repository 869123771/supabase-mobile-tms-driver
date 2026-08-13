<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsRouteCard from '@/components/business/TmsRouteCard.vue'
import { useProfileStore } from '@/stores/profile'
import { useWaybillStore } from '@/stores/waybill'
import { useDictionaryStore } from '@/stores/dictionary'
import { FALLBACK_TRUCK_IMAGE } from '@/utils/assets'
import { getRouteDistanceKm } from '@/utils/route'
import { openWaybillNavigation } from '@/utils/navigation'
import { formatVehicleLoad } from '@/utils/format'
import type { Waybill } from '@/api/types'

const profile = useProfileStore()
const waybill = useWaybillStore()
const dictionary = useDictionaryStore()
const refreshing = ref(false)
const initialized = ref(false)
const loadError = ref('')

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
const vehicleModelSummary = computed(() => {
  const load = vehicle.value?.approvedLoadMass
  const loadLabel = load === undefined || load === null ? '载重待同步' : `载重 ${formatVehicleLoad(load)}`
  return `${vehicleTypeLabel.value} · ${loadLabel}`
})

const vehicleMetrics = computed(() => [
  {
    label: '当前里程',
    value: routeDistanceKm.value === undefined ? '--' : Number(routeDistanceKm.value).toFixed(1),
    unit: routeDistanceKm.value === undefined ? '' : 'km'
  },
  {
    label: '运输次数',
    value: profile.summary?.completedCount ?? 0,
    unit: '次'
  },
  { label: '燃料', value: fuelTypeLabel.value, unit: '' }
])

const taskButtonText = computed(() => {
  const status = task.value?.status
  if (status === 'pending') return '接受任务'
  if (status === 'accepted') return '装货打卡'
  if (status === 'loading') return '录入发车信息'
  if (status === 'transporting') return '到达打卡'
  if (status === 'unloading') return '卸货 / 签收'
  if (status === 'signed') return '确认完成'
  return '查看详情'
})
const taskButtonIcon = computed(() => {
  const status = task.value?.status
  if (status === 'accepted') return 'upload'
  if (status === 'loading') return 'check-circle'
  if (status === 'unloading') return 'upload'
  if (status === 'signed') return 'check'
  if (status === 'pending' || status === 'transporting') return 'check-circle'
  return 'arrow-right'
})
const taskButtonLabel = computed(() => {
  if (!waybill.actionLoading) return taskButtonText.value
  const status = task.value?.status
  if (status === 'pending') return '正在接受任务'
  if (status === 'accepted') return '正在提交提货资料'
  if (status === 'loading') return '正在确认发车'
  if (status === 'transporting') return '正在确认到达'
  if (status === 'unloading') return '正在提交签收资料'
  if (status === 'signed') return '正在完成运单'
  return '正在处理'
})
const taskButtonDisabled = computed(() => waybill.actionLoading || refreshing.value)
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const taskSummary = computed(() => {
  if (!task.value) return '今日暂无待执行任务，保持车辆与通讯畅通'
  if (task.value.status === 'pending') return '有 1 项新任务等待确认，请及时处理'
  return '当前运输任务进行中，请按节点完成操作'
})

onShow(() => {
  void refresh()
})

async function refresh() {
  loadError.value = ''
  refreshing.value = true
  try {
    await profile.load(true)
    await waybill.loadHomeTask()
    await waybill.loadList('all')
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '数据加载失败'
    uni.showToast({
      title: error instanceof Error ? error.message : '数据加载失败',
      icon: 'none'
    })
  } finally {
    refreshing.value = false
    initialized.value = true
  }
}

function openDetail(id?: string) {
  if (!id) return
  uni.navigateTo({ url: `/pages/waybill/detail?id=${id}` })
}

function openWaybillList() {
  uni.reLaunch({ url: '/pages/waybill/index' })
}

function openMine() {
  uni.reLaunch({ url: '/pages/mine/index' })
}

function navigate(item?: Waybill) {
  openWaybillNavigation(item || task.value)
}

async function handleTaskAction() {
  if (!task.value) return
  openDetail(task.value.id)
}
</script>

<template>
  <view class="home-page page">
    <view class="home-page__hero">
      <view class="home-page__mesh" />
      <view class="home-page__ambient" />
      <view class="home-page__top">
        <view class="home-page__identity">
          <view class="home-page__eyebrow">
            <text class="home-page__online-dot" />
            <text>司机工作台</text>
          </view>
          <text class="home-page__welcome">{{ greeting }}，{{ driver?.driverName || '司机师傅' }}</text>
          <text class="home-page__summary">{{ taskSummary }}</text>
        </view>
        <wd-button
          class="home-page__settings"
          type="icon"
          aria-label="打开我的页面"
          custom-style="width: 62rpx; min-width: 62rpx; height: 62rpx; padding: 0; border-radius: 50%; background: rgba(255,255,255,0.14); border: 2rpx solid rgba(255,255,255,0.22); color: #fff;"
          :disabled="refreshing"
          @click="openMine"
        >
          <TmsIcon name="settings" size="36rpx" />
        </wd-button>
      </view>
      <view class="home-page__company-row">
        <text class="home-page__company">{{ carrier?.companyName || '暂未绑定承运商' }}</text>
        <view class="home-page__network">
          <text class="home-page__online-dot" />
          <text>运力在线</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="home-page__scroll">
      <TmsPageSkeleton
        v-if="!initialized || (loadError && !profile.summary)"
        label="正在同步车辆与运输任务…"
        :error="loadError"
        @retry="refresh"
      />
      <view v-else class="home-page__content">
        <view class="vehicle-card card">
          <view class="vehicle-card__title-row">
            <view>
              <text class="section-eyebrow">绑定车辆</text>
              <text class="section-title vehicle-card__title">车辆概览</text>
            </view>
            <view class="vehicle-card__status-group">
              <view v-if="refreshing" class="vehicle-card__refreshing">
                <wd-loading type="ring" color="#3763f4" size="28rpx" />
                <text>刷新中</text>
              </view>
              <text class="vehicle-card__normal">正常</text>
            </view>
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
                {{ vehicleModelSummary }}
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
            <view class="task-card__button-wrap" @tap.stop>
              <wd-button
                class="task-card__button"
                :custom-class="task.status === 'completed' ? 'tms-secondary-action' : 'tms-primary-action'"
                type="primary"
                size="large"
                block
                :round="false"
                :disabled="taskButtonDisabled"
                @click="handleTaskAction"
              >
                <view class="task-card__button-content">
                  <wd-loading v-if="waybill.actionLoading" type="ring" color="#ffffff" size="30rpx" />
                  <wd-icon v-else :name="taskButtonIcon" size="32rpx" />
                  <text>{{ taskButtonLabel }}</text>
                </view>
              </wd-button>
            </view>
          </TmsRouteCard>
        </view>

        <view v-else class="empty-card card">
          <view class="empty-card__icon"><TmsIcon name="waybill" size="54rpx" /></view>
          <view class="empty-card__copy">
            <text class="section-title">当前没有运输任务</text>
            <text class="empty-card__text">新任务到达后会显示在这里，也可以前往运单列表查看。</text>
          </view>
          <wd-button class="empty-card__action" type="text" @click="openWaybillList">
            查看运单
          </wd-button>
        </view>

        <view v-if="todoList.length" class="todo-card card">
          <view class="todo-card__title-row">
            <view>
              <text class="section-eyebrow">待办任务</text>
              <text class="section-title todo-card__title">接下来</text>
            </view>
            <wd-button class="todo-card__all" type="text" @click="openWaybillList">
              <text>全部</text>
              <wd-icon name="chevron-right" size="26rpx" />
            </wd-button>
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
  height: 456rpx;
  padding: calc(54rpx + env(safe-area-inset-top)) 34rpx 104rpx;
  overflow: hidden;
  color: #fff;
  background: var(--tms-hero-gradient);
  border-bottom-left-radius: 46rpx;
  border-bottom-right-radius: 46rpx;
}

.home-page__hero::after {
  position: absolute;
  top: -240rpx;
  right: -180rpx;
  width: 520rpx;
  height: 520rpx;
  content: '';
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  box-shadow:
    0 0 0 70rpx rgba(255, 255, 255, 0.035),
    0 0 0 140rpx rgba(255, 255, 255, 0.02);
}

.home-page__mesh {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx);
  background-size: 72rpx 72rpx;
  pointer-events: none;
}

.home-page__ambient {
  position: absolute;
  left: 36%;
  bottom: -180rpx;
  width: 520rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.22);
  filter: blur(82rpx);
  pointer-events: none;
}

.home-page__top {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 28rpx;
}

.home-page__identity {
  min-width: 0;
  flex: 1;
}

.home-page__eyebrow,
.home-page__network {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 18rpx;
  font-weight: 700;
  opacity: 0.78;
}

.home-page__online-dot {
  flex: 0 0 10rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #5eead4;
  box-shadow: 0 0 0 6rpx rgba(94, 234, 212, 0.13);
}

.home-page__welcome {
  display: block;
  margin-top: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.25;
}

.home-page__summary {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.5;
  opacity: 0.72;
}

.home-page__company-row {
  position: relative;
  z-index: 1;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.13);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.home-page__company {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22rpx;
  font-weight: 700;
  opacity: 0.78;
}

.home-page__network {
  flex: 0 0 auto;
  font-size: 19rpx;
  letter-spacing: 0;
  opacity: 0.82;
}

.home-page__settings {
  flex: 0 0 62rpx;
  width: 62rpx;
  height: 62rpx;
  margin: 0 0 0 auto;
  padding: 0;
  min-width: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 2rpx solid rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-page__settings.is-disabled {
  opacity: 0.72;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
}

.home-page__settings::after {
  border: 0;
}

.home-page__scroll {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  top: 336rpx;
  bottom: calc(142rpx + env(safe-area-inset-bottom));
}

.home-page__content {
  position: relative;
  padding: 0 28rpx 64rpx;
}

.vehicle-card,
.empty-card {
  padding: 30rpx;
  border-radius: 28rpx;
  box-shadow: var(--tms-shadow-md);
}

.vehicle-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.vehicle-card__status-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.section-title {
  color: #172033;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.25;
}

.vehicle-card__title,
.todo-card__title {
  display: block;
  margin-top: 7rpx;
}

.vehicle-card__normal {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  color: #059669;
  background: #ecfdf5;
  font-size: 22rpx;
  font-weight: 700;
}

.vehicle-card__refreshing {
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  color: #4f46e5;
  background: #eef2ff;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  font-size: 23rpx;
  font-weight: 800;
}

.vehicle-card__body {
  margin: 30rpx 0 26rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.vehicle-card__image {
  width: 112rpx;
  height: 90rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
  box-shadow: 0 10rpx 24rpx rgba(40, 52, 80, 0.1);
}

.vehicle-card__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.vehicle-card__plate {
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.vehicle-card__model {
  color: #9aa5b7;
  font-size: 23rpx;
}

.task-card {
  margin-top: 24rpx;
}

.task-card__button-wrap {
  margin-top: 30rpx;
}

.task-card__button {
  width: 100%;
}

.task-card__button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.empty-card {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: 74rpx minmax(0, 1fr);
  align-items: center;
  gap: 20rpx;
}

.empty-card__icon {
  width: 74rpx;
  height: 74rpx;
  border-radius: 22rpx;
  color: #4f46e5;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-card__copy {
  min-width: 0;
}

.empty-card__text {
  display: block;
  margin-top: 8rpx;
  color: #748096;
  font-size: 22rpx;
  line-height: 1.5;
}

.empty-card__action {
  min-width: 0;
  grid-column: 2;
  justify-self: start;
  margin-top: -8rpx;
  padding: 0;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 700;
}

.todo-card {
  margin: 24rpx 0 34rpx;
  padding: 30rpx;
  border-radius: 24rpx;
}

.todo-card::before {
  position: absolute;
  left: 30rpx;
  top: 0;
  width: 76rpx;
  height: 4rpx;
  content: '';
  border-radius: 0 0 999rpx 999rpx;
  background: linear-gradient(90deg, #4f46e5, #3b82f6);
}

.todo-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.todo-card__all {
  color: #748096;
  min-width: 0;
  padding: 0;
  background: transparent;
  font-size: 24rpx;
}

.todo-card__all :deep(.wd-button__content) {
  gap: 2rpx;
}

.todo-card__stack {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

@media screen and (max-width: 350px) {
  .home-page__hero {
    padding-left: 26rpx;
    padding-right: 26rpx;
  }

  .home-page__content {
    padding-left: 20rpx;
    padding-right: 20rpx;
  }

  .empty-card {
    grid-template-columns: 64rpx minmax(0, 1fr);
  }

  .empty-card__action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
