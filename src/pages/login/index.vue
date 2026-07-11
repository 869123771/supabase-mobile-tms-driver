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

</script>

<template>
  <view class="login-page">
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

    <view class="login-form">
      <wd-input
        v-model="account"
        class="login-form__field"
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
        prefix-icon="lock-on"
        placeholder="密码"
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
        <text class="login-form__link">忘记密码?</text>
      </view>

      <wd-button
        class="login-form__button"
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
    <view class="login-page__phone" @tap="phoneLogin">
      <view class="login-page__phone-icon">
        <wd-icon name="mobile" size="54rpx" />
      </view>
      <text>手机一键登录</text>
    </view>
    <!-- #endif -->

    <view class="login-page__agreement">
      登录即视为同意
      <text>《用户协议》</text>
      和
      <text>《隐私政策》</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  padding: calc(188rpx + env(safe-area-inset-top)) 54rpx calc(44rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: flex;
  flex-direction: column;
}

.login-page__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
}

.login-page__mark {
  position: relative;
  width: 82rpx;
  height: 82rpx;
}

.login-page__mark-main {
  position: absolute;
  left: 5rpx;
  top: 14rpx;
  width: 54rpx;
  height: 54rpx;
  background: var(--tms-primary);
  border-radius: 12rpx;
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
  background: var(--tms-orange);
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
  color: #050505;
  font-size: 58rpx;
  font-style: italic;
  font-weight: 900;
  letter-spacing: 0;
}

.login-page__badge {
  height: 48rpx;
  padding: 0 14rpx;
  border-radius: 8rpx;
  background: var(--tms-primary);
  color: #fff;
  font-size: 26rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.login-form {
  margin-top: 126rpx;
}

.login-form__field {
  box-sizing: border-box;
  height: 98rpx;
  padding: 0 28rpx;
  border-radius: 16rpx;
  background: #f5f6fa;
  color: var(--tms-light);
}

.login-form__field + .login-form__field {
  margin-top: 32rpx;
}

.login-form__field :deep(.wd-input__value) {
  height: 98rpx;
}

.login-form__field :deep(.wd-input__prefix) {
  margin-right: 24rpx;
}

.login-form__field :deep(.wd-input__icon),
.login-form__field :deep(.wd-input__clear) {
  color: var(--tms-light);
  font-size: 38rpx;
}

.login-form__field :deep(.wd-input__inner) {
  height: 98rpx;
  color: var(--tms-text);
  font-size: 28rpx;
  background: transparent;
}

.login-form__field :deep(.wd-input__inner::placeholder) {
  color: var(--tms-light);
}

.login-form__field.is-disabled {
  opacity: 0.72;
}

.login-form__options {
  margin-top: 26rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--tms-text);
  font-size: 26rpx;
}

.login-form__remember {
  margin-bottom: 0;
  font-size: 26rpx;
}

.login-form__remember :deep(.wd-checkbox__shape) {
  width: 32rpx;
  height: 32rpx;
  border-width: 2rpx;
  border-radius: 8rpx;
}

.login-form__remember :deep(.wd-checkbox__label) {
  color: var(--tms-text);
  font-size: 26rpx;
}

.login-form__link {
  color: var(--tms-orange);
}

.login-form__button {
  margin-top: 50rpx;
  height: 88rpx;
  border-radius: 16rpx;
  color: #fff;
  background: var(--tms-primary);
  box-shadow: 0 14rpx 24rpx rgba(55, 99, 244, 0.28);
  font-size: 30rpx;
  font-weight: 800;
}

.login-form__button.is-disabled {
  background: #c5cfeb;
  box-shadow: none;
}

.login-page__phone {
  margin-top: auto;
  padding: 0;
  border: 0;
  line-height: 1.2;
  color: var(--tms-light);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  font-size: 26rpx;
}

.login-page__phone::after {
  border: 0;
}

.login-page__phone :deep(.wd-button__content) {
  flex-direction: column;
  gap: 18rpx;
}

.login-page__phone-icon {
  width: 86rpx;
  height: 86rpx;
  border-radius: 50%;
  background: #ff7d3b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-page__agreement {
  margin-top: 72rpx;
  color: var(--tms-light);
  font-size: 22rpx;
  text-align: center;
}

.login-page__agreement text {
  color: var(--tms-primary);
}
</style>
