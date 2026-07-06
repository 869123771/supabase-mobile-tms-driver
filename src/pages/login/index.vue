<script setup lang="ts">
import { ref } from 'vue'
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

onLoad(() => {
  auth.hydrate()
  const cachedAccount = uni.getStorageSync('tms-driver-account')
  if (cachedAccount) account.value = String(cachedAccount)
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/home/index' })
  }
})

async function submit() {
  if (!account.value.trim()) {
    uni.showToast({ title: '请输入账号', icon: 'none' })
    return
  }
  if (!password.value) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await auth.login(account.value, password.value)
    if (remember.value) {
      uni.setStorageSync('tms-driver-account', account.value)
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
  const detail = (event as { detail?: { code?: string; errMsg?: string } } | undefined)?.detail
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
      <view class="login-form__field">
        <wd-icon name="phone" size="38rpx" />
        <input v-model="account" placeholder="请输入手机号/邮箱" confirm-type="next" />
      </view>
      <view class="login-form__field">
        <wd-icon name="lock-on" size="38rpx" />
        <input v-model="password" password placeholder="密码" confirm-type="done" @confirm="submit" />
      </view>

      <view class="login-form__options">
        <view class="login-form__remember" @tap="remember = !remember">
          <view class="login-form__checkbox" :class="{ 'login-form__checkbox--checked': remember }">
            <wd-icon v-if="remember" name="check" size="24rpx" />
          </view>
          <text>记住我</text>
        </view>
        <text class="login-form__link">忘记密码?</text>
      </view>

      <button class="login-form__button" hover-class="none" :loading="loading" @tap="submit">
        登录
      </button>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <button
      class="login-page__phone"
      hover-class="none"
      open-type="getPhoneNumber"
      :loading="phoneLoading"
      :disabled="phoneLoading"
      @getphonenumber="phoneLogin"
    >
      <view class="login-page__phone-icon">
        <wd-icon name="mobile" size="54rpx" />
      </view>
      <text>手机一键登录</text>
    </button>
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
  height: 98rpx;
  padding: 0 28rpx;
  border-radius: 16rpx;
  background: #f5f6fa;
  color: var(--tms-light);
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.login-form__field + .login-form__field {
  margin-top: 32rpx;
}

.login-form__field input {
  flex: 1;
  height: 98rpx;
  color: var(--tms-text);
  font-size: 28rpx;
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
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.login-form__checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #d6dce7;
  border-radius: 8rpx;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form__checkbox--checked {
  border-color: var(--tms-primary);
  background: var(--tms-primary);
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 800;
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
