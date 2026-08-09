<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { maskIdCard, maskPhone, shortName } from '@/utils/format'

const auth = useAuthStore()
const profile = useProfileStore()

const driver = computed(() => profile.driver)
const user = computed(() => profile.user)
const carrier = computed(() => profile.carrier)

const metrics = computed(() => [
  { label: '运输次数', value: profile.summary?.completedCount ?? 0 },
  { label: '运输里程(km)', value: profile.summary?.totalMileageKm ?? 0 },
  { label: '服务评分', value: profile.summary?.rating || '--' }
])

const displayName = computed(
  () => driver.value?.driverName || user.value?.nickName || user.value?.userName || '司机师傅'
)

onShow(() => {
  void load()
})

async function load() {
  try {
    await profile.load(true)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '资料加载失败',
      icon: 'none'
    })
  }
}

function feature(name: string) {
  uni.showToast({ title: `${name}即将开放`, icon: 'none' })
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号吗？',
    confirmColor: '#f05252',
    success: async (result) => {
      if (!result.confirm) return
      profile.clear()
      await auth.logout()
    }
  })
}
</script>

<template>
  <view class="mine-page page safe-bottom">
    <view class="mine-page__hero">
      <view class="mine-page__mesh" />
      <view class="mine-page__eyebrow"><text /> 司机档案</view>
      <view class="mine-page__user">
        <image v-if="user?.avatar" class="mine-page__avatar" :src="user.avatar" mode="aspectFill" />
        <view v-else class="mine-page__avatar mine-page__avatar--text">
          {{ shortName(displayName) }}
        </view>
        <view class="mine-page__profile">
          <text class="mine-page__name">{{ displayName }}</text>
          <text class="mine-page__company">
            {{ carrier?.companyName || '暂未绑定承运商' }}
          </text>
          <view class="mine-page__verified"><wd-icon name="check-circle" size="24rpx" /> 司机档案已同步</view>
        </view>
        <button class="mine-page__setting" hover-class="none" @tap="feature('设置中心')">
          <wd-icon name="setting" size="38rpx" />
        </button>
      </view>
    </view>

    <view class="mine-page__content">
      <view class="mine-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">运输数据</text>
            <text class="section-title">履约表现</text>
          </view>
          <text class="section-head__hint">累计数据</text>
        </view>
        <TmsMetricGrid class="mine-card__metrics" :items="metrics" />
      </view>

      <view class="mine-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">隐私资料</text>
            <text class="section-title">账户信息</text>
          </view>
          <text class="section-head__hint">隐私保护</text>
        </view>
        <view class="account-list">
          <view class="account-list__row">
            <text>手机号</text>
            <text>{{ maskPhone(driver?.phone || user?.userPhone) }}</text>
          </view>
          <view class="account-list__row">
            <text>身份证号</text>
            <text>{{ maskIdCard(driver?.idCardNo) }}</text>
          </view>
          <view class="account-list__row">
            <text>驾驶证号</text>
            <text>{{ maskIdCard(driver?.licenseType ? `${driver?.idCardNo || ''}${driver.licenseType}` : '') }}</text>
          </view>
        </view>
      </view>

      <view class="mine-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">快捷入口</text>
            <text class="section-title">常用服务</text>
          </view>
        </view>
        <view class="feature-grid">
          <view class="feature-grid__item" @tap="feature('我的收入')">
            <view class="feature-grid__icon"><wd-icon name="money-circle" size="46rpx" /></view>
            <text>我的收入</text>
          </view>
          <view class="feature-grid__item" @tap="feature('电子回单')">
            <view class="feature-grid__icon"><wd-icon name="list" size="46rpx" /></view>
            <text>电子回单</text>
          </view>
          <view class="feature-grid__item" @tap="feature('联系客服')">
            <view class="feature-grid__icon"><wd-icon name="service" size="46rpx" /></view>
            <text>联系客服</text>
          </view>
          <view class="feature-grid__item" @tap="feature('帮助中心')">
            <view class="feature-grid__icon"><wd-icon name="help-circle" size="46rpx" /></view>
            <text>帮助中心</text>
          </view>
        </view>
      </view>

      <button class="mine-page__logout" hover-class="none" @tap="logout">退出登录</button>
    </view>

    <TmsBottomNav active="mine" />
  </view>
</template>

<style scoped lang="scss">
.mine-page {
  min-height: 100vh;
  padding-bottom: 190rpx;
  background: #f4f6fa;
}

.mine-page__hero {
  position: relative;
  height: 362rpx;
  padding: calc(46rpx + env(safe-area-inset-top)) 32rpx 100rpx;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #292266 0%, #4f46e5 56%, #2563eb 118%);
}

.mine-page__mesh {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx);
  background-size: 72rpx 72rpx;
}

.mine-page__eyebrow {
  position: relative;
  z-index: 1;
  margin-bottom: 34rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 18rpx;
  font-weight: 800;
  opacity: 0.78;
}

.mine-page__eyebrow text {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #5eead4;
  box-shadow: 0 0 0 6rpx rgba(94, 234, 212, 0.12);
}

.mine-page__user {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 58rpx;
  align-items: center;
  gap: 22rpx;
}

.mine-page__avatar {
  width: 94rpx;
  height: 94rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background: #fff;
}

.mine-page__avatar--text {
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 800;
}

.mine-page__profile {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.mine-page__name {
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.2;
}

.mine-page__company {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 22rpx;
  font-weight: 600;
  opacity: 0.72;
}

.mine-page__verified {
  color: #8ff4dc;
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.mine-page__setting {
  width: 58rpx;
  height: 58rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mine-page__content {
  position: relative;
  z-index: 2;
  margin-top: -54rpx;
  padding: 0 28rpx 52rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.mine-card {
  padding: 30rpx;
  border-radius: 24rpx;
}

.mine-card:first-child {
  box-shadow: 0 18rpx 46rpx rgba(34, 39, 91, 0.12);
}

.mine-card__metrics {
  margin-top: 26rpx;
}

.section-title {
  display: block;
  margin-top: 7rpx;
  color: #172033;
  font-size: 31rpx;
  font-weight: 800;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.section-head__hint {
  color: #748096;
  font-size: 21rpx;
}

.account-list {
  margin-top: 24rpx;
}

.account-list__row {
  min-height: 80rpx;
  border-bottom: 1rpx solid #e8ecf3;
  color: #172033;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  font-size: 26rpx;
}

.account-list__row:last-child {
  border-bottom: 0;
}

.account-list__row text:first-child {
  flex: 0 0 160rpx;
}

.account-list__row text:last-child {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.feature-grid {
  margin-top: 28rpx;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.feature-grid__item {
  min-width: 0;
  color: #748096;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.feature-grid__icon {
  width: 86rpx;
  height: 86rpx;
  border-radius: 24rpx;
  color: #4f46e5;
  background: #f7f9fc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-grid__item:nth-child(2) .feature-grid__icon {
  color: #059669;
  background: #ecfdf5;
}

.feature-grid__item:nth-child(3) .feature-grid__icon {
  color: #d97706;
  background: #fffbeb;
}

.feature-grid__item:nth-child(4) .feature-grid__icon {
  color: #2563eb;
  background: #eff6ff;
}

.mine-page__logout {
  width: 100%;
  height: 88rpx;
  margin-top: 6rpx;
  padding: 0;
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  border-radius: 16rpx;
  color: #dc2626;
  background: #fef2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 800;
}
</style>
