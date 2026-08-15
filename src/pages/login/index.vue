<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

const auth = useAuthStore()
const profile = useProfileStore()
const account = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const phoneLoading = ref(false)
const accountValue = computed(() => account.value.trim())
const canSubmit = computed(() => Boolean(accountValue.value && password.value && !loading.value))

onLoad(() => {
  auth.hydrate()
  const cachedAccount = uni.getStorageSync('tms-driver-account')
  if (cachedAccount) account.value = String(cachedAccount)
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/home/index' })
  }
})

async function submit() {
  if (loading.value) return
  if (!accountValue.value) {
    uni.showToast({ title: '请输入账号', icon: 'none' })
    return
  }
  if (!password.value) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await auth.login(accountValue.value, password.value)
    if (remember.value) {
      uni.setStorageSync('tms-driver-account', accountValue.value)
    } else {
      uni.removeStorageSync('tms-driver-account')
    }
    await profile.load(true)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '登录失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

async function phoneLogin(event?: unknown) {
  if (phoneLoading.value) return
  const payload = event as { code?: string; detail?: { code?: string; errMsg?: string } } | undefined
  const detail = payload?.detail || payload
  const phoneCode = detail?.code

  if (!phoneCode) {
    uni.showToast({ title: '请在微信小程序中授权手机号登录', icon: 'none' })
    return
  }

  phoneLoading.value = true
  try {
    await auth.loginWithWechatPhone(phoneCode)
    await profile.load(true)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '手机号登录失败',
      icon: 'none'
    })
  } finally {
    phoneLoading.value = false
  }
}

function forgotPassword() {
  uni.showToast({ title: '请联系车队管理员重置密码', icon: 'none' })
}

</script>

<template>
  <view class="login-page">
    <view class="login-page__orb login-page__orb--one" />
    <view class="login-page__orb login-page__orb--two" />
    <view class="login-page__grid" />

    <view class="login-page__hero">
      <view class="login-page__brand">
        <view class="login-page__mark">
          <view class="login-page__mark-main" />
          <view class="login-page__mark-dots">
            <text />
            <text />
            <text />
          </view>
        </view>
        <text class="login-page__name">TMS</text>
        <text class="login-page__badge">司机端</text>
      </view>
      <text class="login-page__eyebrow">智慧运输协同</text>
      <text class="login-page__title">每一程，都清晰可控</text>
      <text class="login-page__description">任务、路线、车辆与回单集中处理，让运输履约更简单。</text>
      <view class="login-page__trust">
        <view><text class="login-page__trust-dot" />任务实时同步</view>
        <view><text class="login-page__trust-dot" />数据安全连接</view>
      </view>
    </view>

    <view class="login-form">
      <view class="login-form__head">
        <view>
          <text class="login-form__title">账号登录</text>
          <text class="login-form__hint">使用后台分配的司机账号</text>
        </view>
        <text class="login-form__secure">安全登录</text>
      </view>
      <wd-input
        v-model="account"
        class="login-form__field"
        aria-label="手机号或邮箱"
        prefix-icon="phone"
        placeholder="请输入手机号/邮箱"
        type="text"
        confirm-type="next"
        clearable
        no-border
        :disabled="loading"
      />
      <wd-input
        v-model="password"
        class="login-form__field"
        aria-label="登录密码"
        prefix-icon="lock-on"
        placeholder="请输入登录密码"
        show-password
        confirm-type="done"
        no-border
        :disabled="loading"
        @confirm="submit"
      />

      <view class="login-form__options">
        <wd-checkbox
          v-model="remember"
          class="login-form__remember"
          shape="square"
          checked-color="#3763f4"
          :disabled="loading"
        >
          记住我
        </wd-checkbox>
        <button
          class="login-form__link"
          hover-class="login-form__link--pressed"
          @tap="forgotPassword"
        >
          忘记密码？
        </button>
      </view>

      <wd-button
        class="login-form__button"
        custom-class="tms-primary-action"
        type="primary"
        size="large"
        block
        :round="false"
        :loading="loading"
        :disabled="!canSubmit"
        @click="submit"
      >
        登录
      </wd-button>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <wd-button
      class="login-page__phone"
      open-type="getPhoneNumber"
      type="text"
      :loading="phoneLoading"
      :disabled="phoneLoading"
      @getphonenumber="phoneLogin"
    >
      <view class="login-page__phone-icon">
        <wd-icon name="mobile" size="54rpx" />
      </view>
      <text>手机一键登录</text>
    </wd-button>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <button
      class="login-page__phone"
      aria-label="使用手机号一键登录"
      hover-class="login-page__phone--pressed"
      @tap="phoneLogin"
    >
      <view class="login-page__phone-icon">
        <wd-icon name="mobile" size="54rpx" />
      </view>
      <text>手机一键登录</text>
    </button>
    <!-- #endif -->

    <view class="login-page__agreement">
      登录即表示您已阅读并同意
      <text>《用户协议》</text>
      和
      <text>《隐私政策》</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  position: relative;
  min-height: 100vh;
  padding: calc(70rpx + env(safe-area-inset-top)) 34rpx calc(32rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
  background:
    radial-gradient(circle at 92% 2%, rgba(79, 70, 229, 0.12), transparent 360rpx),
    linear-gradient(180deg, #f7f8ff 0%, #ffffff 54%, #f8fafc 100%);
  display: flex;
  flex-direction: column;
}

.login-page__orb {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
}

.login-page__orb--one {
  top: -220rpx;
  right: -220rpx;
  width: 540rpx;
  height: 540rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.12);
  box-shadow:
    0 0 0 74rpx rgba(79, 70, 229, 0.025),
    0 0 0 148rpx rgba(79, 70, 229, 0.018);
}

.login-page__orb--two {
  left: -120rpx;
  bottom: 120rpx;
  width: 260rpx;
  height: 260rpx;
  background: rgba(56, 189, 248, 0.05);
  filter: blur(8rpx);
}

.login-page__grid {
  position: absolute;
  inset: 0 0 auto;
  height: 620rpx;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(79, 70, 229, 0.08) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(79, 70, 229, 0.08) 1rpx, transparent 1rpx);
  background-size: 82rpx 82rpx;
  mask-image: linear-gradient(to bottom, #000, transparent);
  pointer-events: none;
}

.login-page__hero,
.login-form,
.login-page__phone,
.login-page__agreement {
  position: relative;
  z-index: 1;
}

.login-page__hero {
  padding: 0 14rpx;
}

.login-page__brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.login-page__mark {
  position: relative;
  width: 72rpx;
  height: 72rpx;
}

.login-page__mark-main {
  position: absolute;
  left: 5rpx;
  top: 14rpx;
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  border-radius: 14rpx;
  box-shadow: 0 12rpx 22rpx rgba(79, 70, 229, 0.22);
  transform: rotate(45deg);
}

.login-page__mark-dots {
  position: absolute;
  right: 0;
  top: 20rpx;
  width: 38rpx;
  height: 42rpx;
}

.login-page__mark-dots text {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #f59e0b;
}

.login-page__mark-dots text:nth-child(1) {
  left: 0;
  top: 14rpx;
}

.login-page__mark-dots text:nth-child(2) {
  left: 16rpx;
  top: 0;
}

.login-page__mark-dots text:nth-child(3) {
  right: 0;
  bottom: 0;
}

.login-page__name {
  color: #172033;
  font-size: 50rpx;
  font-style: italic;
  font-weight: 900;
  letter-spacing: 0;
}

.login-page__badge {
  height: 42rpx;
  padding: 0 14rpx;
  border-radius: 10rpx;
  background: #4f46e5;
  color: #fff;
  font-size: 23rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.login-page__eyebrow {
  display: block;
  margin-top: 64rpx;
  color: #4f46e5;
  font-size: 19rpx;
  font-weight: 800;
}

.login-page__title {
  display: block;
  margin-top: 18rpx;
  color: #172033;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: -1rpx;
}

.login-page__description {
  display: block;
  max-width: 590rpx;
  margin-top: 18rpx;
  color: #748096;
  font-size: 25rpx;
  font-weight: 500;
  line-height: 1.65;
}

.login-page__trust {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
  gap: 28rpx;
  color: #4b5870;
  font-size: 21rpx;
  font-weight: 600;
}

.login-page__trust view {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.login-page__trust-dot {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 5rpx rgba(16, 185, 129, 0.1);
}

.login-form {
  margin-top: 62rpx;
  padding: 32rpx;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid #e7ebf2;
  border-radius: 28rpx;
  box-shadow: 0 24rpx 64rpx rgba(34, 39, 91, 0.14);
  backdrop-filter: blur(24rpx);
}

.login-form__head {
  margin-bottom: 28rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.login-form__title,
.login-form__hint {
  display: block;
}

.login-form__title {
  color: #172033;
  font-size: 30rpx;
  font-weight: 800;
}

.login-form__hint {
  margin-top: 8rpx;
  color: #748096;
  font-size: 21rpx;
}

.login-form__secure {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  color: #059669;
  background: #ecfdf5;
  font-size: 20rpx;
  font-weight: 700;
}

.login-form__field {
  box-sizing: border-box;
  height: 98rpx;
  padding: 0 28rpx;
  border: 1rpx solid #e8ecf3;
  border-radius: 16rpx;
  background: linear-gradient(145deg, #f8fafc, #f5f7fb);
  color: #9aa5b7;
}

.login-form__field + .login-form__field {
  margin-top: 20rpx;
}

.login-form__field :deep(.wd-input__value) {
  height: 98rpx;
}

.login-form__field :deep(.wd-input__prefix) {
  margin-right: 24rpx;
}

.login-form__field :deep(.wd-input__icon),
.login-form__field :deep(.wd-input__clear) {
  color: #9aa5b7;
  font-size: 38rpx;
}

.login-form__field :deep(.wd-input__inner) {
  height: 98rpx;
  color: #172033;
  font-size: 28rpx;
  background: transparent;
}

.login-form__field :deep(.wd-input__inner::placeholder) {
  color: #9aa5b7;
}

.login-form__field.is-disabled {
  opacity: 0.72;
}

.login-form__options {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #172033;
  font-size: 26rpx;
}

.login-form__remember {
  margin-bottom: 0;
  font-size: 24rpx;
}

.login-form__remember :deep(.wd-checkbox__shape) {
  width: 32rpx;
  height: 32rpx;
  border-width: 2rpx;
  border-radius: 10rpx;
}

.login-form__remember :deep(.wd-checkbox__label) {
  color: #172033;
  font-size: 23rpx;
}

.login-form__link {
  min-height: 56rpx;
  margin: -12rpx 0;
  padding: 0 4rpx 0 18rpx;
  border: 0;
  color: #4f46e5;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1;
}

.login-form__link::after {
  border: 0;
}

.login-form__link--pressed {
  color: #3730a3;
  background: rgba(79, 70, 229, 0.06);
}

.login-form__button {
  margin-top: 34rpx;
}

@media screen and (max-height: 700px) {
  .login-page {
    padding-top: calc(38rpx + env(safe-area-inset-top));
  }

  .login-page__eyebrow {
    margin-top: 34rpx;
  }

  .login-form {
    margin-top: 38rpx;
  }
}

.login-form__button.is-disabled {
  background: #c5cfeb;
  box-shadow: none;
}

.login-page__phone {
  min-width: 180rpx;
  min-height: 126rpx;
  margin-right: auto;
  margin-left: auto;
  margin-top: 32rpx;
  padding: 0;
  border: 0;
  line-height: 1.2;
  color: #748096;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  font-size: 26rpx;
}

.login-page__phone--pressed {
  opacity: 0.82;
}

.login-page__phone::after {
  border: 0;
}

.login-page__phone :deep(.wd-button__content) {
  flex-direction: column;
  gap: 18rpx;
}

.login-page__phone-icon {
  width: 74rpx;
  height: 74rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #fb923c, #f59e0b);
  box-shadow: 0 12rpx 24rpx rgba(245, 158, 11, 0.22);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-page__agreement {
  margin-top: auto;
  padding-top: 30rpx;
  color: #9aa5b7;
  font-size: 20rpx;
  line-height: 1.6;
  text-align: center;
}

.login-page__agreement text {
  color: #4f46e5;
}
</style>
