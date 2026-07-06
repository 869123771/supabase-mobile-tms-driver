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
  { label: '运输次数', value: Math.max(profile.summary?.completedCount || 0, 86) },
  { label: '运输里程(km)', value: Math.max(profile.summary?.totalMileageKm || 0, 12560) },
  { label: '服务评分', value: profile.summary?.rating || 4.9 }
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
      <view class="mine-page__user">
        <image v-if="user?.avatar" class="mine-page__avatar" :src="user.avatar" mode="aspectFill" />
        <view v-else class="mine-page__avatar mine-page__avatar--text">
          {{ shortName(displayName) }}
        </view>
        <view class="mine-page__profile">
          <text class="mine-page__name">{{ displayName }}</text>
          <text class="mine-page__company">
            {{ carrier?.companyName || '原型铺子物流运输有限公司' }} · 10年驾龄
          </text>
        </view>
        <button class="mine-page__setting" hover-class="none">
          <wd-icon name="setting" size="38rpx" />
        </button>
      </view>
    </view>

    <view class="mine-page__content">
      <view class="mine-card card">
        <text class="section-title">我的数据</text>
        <TmsMetricGrid class="mine-card__metrics" :items="metrics" />
      </view>

      <view class="mine-card card">
        <text class="section-title">账户信息</text>
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
        <text class="section-title">常用功能</text>
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
  padding-bottom: 160rpx;
  background: var(--tms-bg);
}

.mine-page__hero {
  height: 330rpx;
  padding: calc(60rpx + env(safe-area-inset-top)) 30rpx 96rpx;
  color: #fff;
  background: var(--tms-primary);
}

.mine-page__user {
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 58rpx;
  align-items: center;
  gap: 22rpx;
}

.mine-page__avatar {
  width: 86rpx;
  height: 86rpx;
  border-radius: 50%;
  background: #fff;
}

.mine-page__avatar--text {
  color: var(--tms-primary);
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
  gap: 12rpx;
}

.mine-page__name {
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.2;
}

.mine-page__company {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 23rpx;
  font-weight: 700;
  opacity: 0.9;
}

.mine-page__setting {
  width: 58rpx;
  height: 58rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mine-page__content {
  margin-top: -40rpx;
  padding: 0 30rpx 34rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.mine-card {
  padding: 28rpx 30rpx;
  border-radius: 14rpx;
}

.mine-card__metrics {
  margin-top: 26rpx;
}

.section-title {
  color: var(--tms-text);
  font-size: 31rpx;
  font-weight: 800;
}

.account-list {
  margin-top: 24rpx;
}

.account-list__row {
  min-height: 74rpx;
  border-bottom: 1rpx solid var(--tms-line);
  color: var(--tms-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  font-size: 28rpx;
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
  gap: 22rpx;
}

.feature-grid__item {
  min-width: 0;
  color: var(--tms-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  font-size: 24rpx;
}

.feature-grid__icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 10rpx;
  color: var(--tms-primary);
  background: var(--tms-panel);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mine-page__logout {
  width: 100%;
  height: 88rpx;
  margin-top: 6rpx;
  padding: 0;
  border-radius: 8rpx;
  color: #fff;
  background: #f45258;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 800;
}
</style>
