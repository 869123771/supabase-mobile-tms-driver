<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import { getUserFacingErrorMessage } from '@/api/supabase'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useWaybillStore } from '@/stores/waybill'
import { maskIdCard, maskPhone } from '@/utils/format'
import { usePageTheme } from '@/composables/usePageTheme'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()
const waybill = useWaybillStore()

const driver = computed(() => profile.driver)
const user = computed(() => profile.user)
const carrier = computed(() => profile.carrier)
const initialLoading = ref(!profile.summary)
const syncing = ref(false)
const loadError = ref('')
const openingExpense = ref(false)
const helpVisible = ref(false)
const contactNoticeVisible = ref(false)
const logoutConfirmVisible = ref(false)
const serviceButtonStyle = 'width: 100%; height: 132rpx; min-height: 132rpx; padding: 0; font-size: max(26rpx, 12px); line-height: 1.3; background: transparent; border: 0;'
const showSkeleton = computed(() => !profile.summary && (initialLoading.value || Boolean(loadError.value)))

const metrics = computed(() => [
  { label: '运输次数', value: profile.summary?.completedCount ?? 0 },
  { label: '运输里程', value: profile.summary?.totalMileageKm ?? 0, unit: 'km' },
  { label: '服务评分', value: profile.summary?.rating || '--' }
])

const displayName = computed(
  () => driver.value?.driverName || user.value?.nickName || user.value?.userName || '司机师傅'
)
const avatarInitial = computed(() => Array.from(displayName.value.trim())[0] || '司')

onShow(() => {
  void load()
})

async function load() {
  if (syncing.value) return
  syncing.value = true
  if (!profile.summary) initialLoading.value = true
  loadError.value = ''
  try {
    await profile.load(true)
  } catch (error) {
    loadError.value = getUserFacingErrorMessage(error, '司机档案同步失败，请重试')
    if (profile.summary) uni.showToast({ title: loadError.value, icon: 'none' })
  } finally {
    syncing.value = false
    initialLoading.value = false
  }
}

async function refreshProfile() {
  await load()
  if (!loadError.value) uni.showToast({ title: '司机档案已更新', icon: 'success' })
}

async function openExpense() {
  if (openingExpense.value) return
  openingExpense.value = true
  try {
    const list = await waybill.loadList('all')
    const item = list.find((entry) =>
      ['accepted', 'loading', 'transporting', 'unloading', 'signed', 'completed'].includes(entry.status)
    )
    if (item) {
      uni.navigateTo({ url: `/pages/waybill/expense?id=${encodeURIComponent(item.id)}` })
    } else {
      uni.showToast({ title: '暂无可查看费用的运单', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: getUserFacingErrorMessage(error, '费用记录加载失败，请重试'), icon: 'none' })
  } finally {
    openingExpense.value = false
  }
}

function openCompletedWaybills() {
  uni.reLaunch({ url: '/pages/waybill/index?group=completed' })
}

function contactCarrier() {
  const phone = carrier.value?.contactPhone
  if (phone) {
    uni.makePhoneCall({ phoneNumber: phone })
  } else {
    contactNoticeVisible.value = true
  }
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

async function confirmLogout() {
  logoutConfirmVisible.value = false
  try {
    profile.clear()
    await auth.logout()
  } catch {
    uni.showToast({ title: '退出登录失败，请稍后重试', icon: 'none' })
  }
}
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="mine-page page safe-bottom">
    <scroll-view scroll-y class="mine-page__scroll">
    <view class="mine-page__hero">
      <view class="mine-page__mesh" />
      <view class="mine-page__ambient" />
      <view class="mine-page__eyebrow"><text /> 司机档案</view>
      <text v-if="showSkeleton" class="mine-page__loading">正在同步司机档案…</text>
      <view v-else class="mine-page__user">
        <image
          v-if="user?.avatar"
          class="mine-page__avatar"
          :src="user.avatar"
          mode="aspectFill"
          :aria-label="`${displayName}的头像`"
        />
        <view v-else class="mine-page__avatar mine-page__avatar--text">
          {{ avatarInitial }}
        </view>
        <view class="mine-page__profile">
          <text class="mine-page__name">{{ displayName }}</text>
          <text class="mine-page__company">
            {{ carrier?.companyName || '暂未绑定承运商' }}
          </text>
          <view class="mine-page__verified"><TmsIcon name="success" size="24rpx" /> 司机档案已同步</view>
        </view>
        <wd-button
          class="mine-page__setting"
          aria-label="刷新司机档案"
          custom-style="width: 88rpx; min-width: 44px; height: 88rpx; min-height: 44px; padding: 0; border-radius: 50%; background: rgba(255,255,255,0.14); border: 2rpx solid rgba(255,255,255,0.22); color: #fff;"
          :disabled="syncing"
          @click="refreshProfile"
        >
          <TmsIcon name="refresh" size="36rpx" />
        </wd-button>
      </view>
    </view>

    <TmsPageSkeleton
      v-if="showSkeleton"
      label="正在同步司机档案…"
      :error="loadError"
      @retry="load"
    />
    <view v-else class="mine-page__content">
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
            <text>准驾车型</text>
            <text>{{ driver?.licenseType || '--' }}</text>
          </view>
        </view>
      </view>

      <view class="mine-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">偏好设置</text>
            <text class="section-title">设置</text>
          </view>
          <text class="section-head__hint">按习惯调整</text>
        </view>
        <button class="mine-settings-link" aria-label="打开设置，管理主题配色" @tap="openSettings">
          <view class="mine-settings-link__icon" aria-hidden="true"><TmsIcon name="settings" size="34rpx" /></view>
          <view class="mine-settings-link__copy">
            <text class="mine-settings-link__title">主题配色</text>
            <text class="mine-settings-link__description">管理全局外观</text>
          </view>
          <TmsIcon name="arrow-right" size="28rpx" />
        </button>
      </view>

      <view class="mine-card card">
        <view class="section-head">
          <view>
            <text class="section-eyebrow">快捷入口</text>
            <text class="section-title">常用服务</text>
          </view>
        </view>
        <view class="feature-grid">
          <wd-button variant="text" custom-class="feature-grid__item" :custom-style="serviceButtonStyle" :disabled="openingExpense" @click="openExpense">
            <view class="feature-grid__icon"><TmsIcon name="expense" size="46rpx" /></view>
            <text>费用记录</text>
          </wd-button>
          <wd-button variant="text" custom-class="feature-grid__item" :custom-style="serviceButtonStyle" @click="openCompletedWaybills">
            <view class="feature-grid__icon"><TmsIcon name="receipt" size="46rpx" /></view>
            <text>电子回单</text>
          </wd-button>
          <wd-button variant="text" custom-class="feature-grid__item" :custom-style="serviceButtonStyle" @click="contactCarrier">
            <view class="feature-grid__icon"><TmsIcon name="support" size="46rpx" /></view>
            <text>联系车队</text>
          </wd-button>
          <wd-button variant="text" custom-class="feature-grid__item" :custom-style="serviceButtonStyle" @click="helpVisible = true">
            <view class="feature-grid__icon"><TmsIcon name="help" size="46rpx" /></view>
            <text>使用说明</text>
          </wd-button>
        </view>
      </view>

      <wd-button custom-class="mine-page__logout" type="danger" variant="soft" block @click="logoutConfirmVisible = true">退出登录</wd-button>
    </view>
    </scroll-view>

    <TmsBottomNav active="mine" />
    <wd-popup v-model="helpVisible" position="bottom" round safe-area-inset-bottom :z-index="60" custom-class="mine-help">
      <view class="mine-help__panel">
        <view class="mine-help__head">
          <view>
            <text class="section-eyebrow">运输流程</text>
            <text class="section-title">使用说明</text>
          </view>
          <wd-button variant="text" custom-class="mine-help__close" aria-label="关闭使用说明" @click="helpVisible = false">
            <TmsIcon name="close" size="28rpx" />
          </wd-button>
        </view>
        <view class="mine-help__steps">
          <view><text>01</text><text>在运单列表核对站点与货物信息，接受任务。</text></view>
          <view><text>02</text><text>到达装货地打卡，填写重量并上传照片与磅单。</text></view>
          <view><text>03</text><text>录入发车信息；到达后完成卸货、签收及回单上传。</text></view>
          <view><text>04</text><text>录入收车里程与车辆照片；垫付费用可在运单内上报。</text></view>
        </view>
        <wd-button type="primary" custom-class="tms-primary-action mine-help__done" block @click="helpVisible = false">我知道了</wd-button>
      </view>
    </wd-popup>
    <wd-popup v-model="contactNoticeVisible" position="center" round :z-index="70" custom-class="mine-dialog">
      <view class="mine-dialog__body" role="alertdialog" aria-label="联系车队">
        <text class="mine-dialog__title">联系车队</text>
        <text class="mine-dialog__message">当前承运商尚未配置联系电话，请联系车队管理员。</text>
        <wd-button type="primary" block @click="contactNoticeVisible = false">我知道了</wd-button>
      </view>
    </wd-popup>
    <wd-popup v-model="logoutConfirmVisible" position="center" round :z-index="70" custom-class="mine-dialog">
      <view class="mine-dialog__body" role="alertdialog" aria-label="退出登录">
        <text class="mine-dialog__title">退出登录</text>
        <text class="mine-dialog__message">确认退出当前账号吗？</text>
        <view class="mine-dialog__actions">
          <wd-button variant="plain" type="primary" @click="logoutConfirmVisible = false">取消</wd-button>
          <wd-button type="danger" @click="confirmLogout">退出登录</wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.mine-page {
  height: 100vh;
  height: 100dvh;
  padding-bottom: var(--tms-tabbar-space);
  overflow: hidden;
  background: var(--tms-bg);
  display: flex;
  flex-direction: column;
}

.mine-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}

.mine-page__hero {
  position: relative;
  height: 362rpx;
  padding: calc(46rpx + env(safe-area-inset-top)) 32rpx 100rpx;
  overflow: hidden;
  color: #fff;
  background: var(--tms-hero-gradient);
  border-bottom-left-radius: 46rpx;
  border-bottom-right-radius: 46rpx;
}

.mine-page__hero::after {
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
  pointer-events: none;
}

.mine-page__mesh {
  position: absolute;
  inset: 0;
  opacity: 0.055;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1rpx, transparent 1rpx);
  background-size: 72rpx 72rpx;
}

.mine-page__ambient {
  position: absolute;
  right: -20rpx;
  bottom: -170rpx;
  width: 480rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(var(--tms-primary-rgb), 0.24);
  filter: blur(78rpx);
}

.mine-page__eyebrow {
  position: relative;
  z-index: 1;
  margin-bottom: 34rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: max(18rpx, 12px);
  font-weight: 700;
  opacity: 0.78;
}

.mine-page__eyebrow text {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #5eead4;
  box-shadow: 0 0 0 6rpx rgba(94, 234, 212, 0.12);
}

.mine-page__loading {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 54rpx;
  font-size: max(28rpx, 12px);
  font-weight: 700;
  line-height: 1.4;
  opacity: 0.9;
}

.mine-page__user {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 94rpx minmax(0, 1fr) var(--tms-control-height);
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
  color: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: max(28rpx, 12px);
  font-weight: 700;
}

.mine-page__profile {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.mine-page__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.2;
}

.mine-page__company {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: max(22rpx, 12px);
  font-weight: 600;
  opacity: 0.72;
}

.mine-page__verified {
  color: #8ff4dc;
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: max(20rpx, 12px);
  font-weight: 700;
}

.mine-page__setting {
  width: var(--tms-control-height);
  height: var(--tms-control-height);
  margin: 0;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mine-page__setting::after {
  border: 0;
}

.mine-page__setting--pressed {
  background: rgba(255, 255, 255, 0.22);
}

.mine-page__content {
  position: relative;
  z-index: 2;
  margin-top: -54rpx;
  padding: 0 28rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.mine-card {
  padding: 30rpx;
  border-radius: 24rpx;
}

.mine-card:first-child {
  box-shadow: var(--tms-shadow-md);
}

.mine-card__metrics {
  margin-top: 26rpx;
}

.section-title {
  display: block;
  margin-top: 7rpx;
  color: #172033;
  font-size: 31rpx;
  font-weight: 700;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.section-head__hint {
  color: #748096;
  font-size: max(21rpx, 12px);
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
  font-size: max(26rpx, 12px);
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

.mine-settings-link {
  margin-top: 24rpx;
  width: 100%;
  min-height: var(--tms-control-height);
  padding: 18rpx 20rpx;
  border: 1rpx solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  color: var(--tms-text);
  background: var(--tms-panel);
  display: flex;
  align-items: center;
  gap: 18rpx;
  text-align: left;
}

.mine-settings-link::after {
  border: 0;
}

.mine-settings-link:active {
  border-color: var(--tms-primary);
}

.mine-settings-link:focus-visible {
  outline: 4rpx solid rgba(var(--tms-primary-rgb), 0.35);
  outline-offset: 3rpx;
}

.mine-settings-link__icon {
  flex: none;
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mine-settings-link__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.mine-settings-link__title {
  font-size: max(26rpx, 12px);
  font-weight: 700;
}

.mine-settings-link__description {
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
}

.mine-settings-link > :last-child {
  color: var(--tms-muted);
}

.feature-grid {
  margin-top: 28rpx;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.feature-grid__item {
  width: 100%;
  height: auto;
  min-height: 132rpx;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  min-width: 0;
  color: #748096;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  font-size: max(22rpx, 12px);
  font-weight: 600;
  transition: transform 160ms ease;
}

.feature-grid :deep(.feature-grid__item .wd-button__content),
.feature-grid :deep(.feature-grid__item .wd-button__text) {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  line-height: 1.3;
  white-space: normal;
}

.feature-grid__item--pressed,
.feature-grid__item:active {
  transform: translateY(2rpx) scale(0.97);
}

.feature-grid__icon {
  width: 86rpx;
  height: 86rpx;
  border-radius: 24rpx;
  color: var(--tms-primary);
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
  color: var(--tms-primary-bright);
  background: var(--tms-primary-soft);
}

.mine-page__logout {
  width: 100%;
  height: var(--tms-control-height);
  margin-top: 6rpx;
  padding: 0;
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  border-radius: var(--tms-control-radius);
  color: #dc2626;
  background: #fef2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--tms-control-font-size);
  font-weight: 700;
}

.mine-page__logout:active {
  opacity: 0.82;
}

.mine-help {
  width: 100%;
}

.mine-help__panel {
  position: relative;
  width: 100%;
  padding: 32rpx 32rpx calc(34rpx + env(safe-area-inset-bottom));
  border-radius: 32rpx 32rpx 0 0;
  background: #fff;
  box-shadow: 0 -20rpx 60rpx rgba(17, 24, 39, 0.16);
}

.mine-help__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mine-help__close {
  width: 72rpx;
  height: 72rpx;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  color: #64748b;
  background: #f1f5f9;
  font-size: 42rpx;
  line-height: 72rpx;
}

.mine-help__steps {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin: 32rpx 0;
}

.mine-help__steps view {
  display: grid;
  grid-template-columns: 56rpx minmax(0, 1fr);
  align-items: start;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f6f8fc;
  color: #475569;
  font-size: max(24rpx, 12px);
  line-height: 1.5;
}

.mine-help__steps view text:first-child {
  color: var(--tms-primary);
  font-weight: 700;
}

.mine-help__done {
  width: 100%;
  height: 88rpx;
  margin: 0;
  border-radius: 18rpx;
  color: #fff;
  background: var(--tms-hero-gradient);
  font-size: max(27rpx, 12px);
  font-weight: 700;
  line-height: 88rpx;
}

.mine-dialog {
  width: min(84vw, 520rpx);
}

.mine-dialog__body {
  box-sizing: border-box;
  width: min(84vw, 600rpx);
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  background: #fff;
}

.mine-dialog__title {
  color: var(--tms-text);
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.3;
}

.mine-dialog__message {
  color: var(--tms-muted);
  font-size: max(25rpx, 12px);
  line-height: 1.5;
}

.mine-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.mine-dialog__actions :deep(.wd-button) {
  width: 100%;
}

@media (max-width: 360px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 18rpx;
  }
}
</style>
