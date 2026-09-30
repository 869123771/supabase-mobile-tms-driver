<script setup lang="ts">
import TmsTopBar from '@/components/business/TmsTopBar.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { THEME_PRESETS, type ThemePresetId } from '@/stores/theme'

const { theme, themeName } = usePageTheme()

function selectTheme(preset: ThemePresetId) {
  if (!theme.selectPreset(preset)) {
    uni.showToast({ title: '主题已切换，但保存失败；下次打开请重新选择', icon: 'none' })
  }
}
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="settings-page page">
    <TmsTopBar title="设置" eyebrow="偏好设置" subtitle="调整司机端的显示方式" show-back />
    <scroll-view scroll-y class="settings-page__scroll">
      <view class="settings-page__content">
        <view class="settings-card card">
          <view class="settings-card__head">
            <view>
              <text class="section-eyebrow">外观设置</text>
              <text class="section-title">主题配色</text>
            </view>
            <text class="settings-card__hint">切换后立即生效</text>
          </view>
          <view class="theme-options" role="group" aria-label="主题配色">
            <button
              v-for="preset in THEME_PRESETS"
              :key="preset.id"
              class="theme-option"
              :class="[`tms-theme-${preset.id}`, { 'theme-option--active': theme.preset === preset.id }]"
              :aria-pressed="theme.preset === preset.id"
              @tap="selectTheme(preset.id)"
            >
              <view class="theme-option__swatch" aria-hidden="true" />
              <view class="theme-option__copy">
                <text class="theme-option__name">{{ preset.name }}</text>
                <text class="theme-option__description">{{ preset.description }}</text>
              </view>
              <text class="theme-option__state">{{ theme.preset === preset.id ? '已选' : '选择' }}</text>
            </button>
          </view>
        </view>
        <text class="settings-page__note">所选配色会应用到所有页面，并在下次打开时保留。</text>
      </view>
    </scroll-view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.settings-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}

.settings-page__content {
  padding: 28rpx 28rpx calc(32rpx + env(safe-area-inset-bottom));
}

.settings-card {
  padding: 30rpx;
}

.settings-card__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.settings-card__head > view {
  min-width: 0;
}

.section-title {
  display: block;
  margin-top: 7rpx;
}

.settings-card__hint {
  flex: none;
  color: var(--tms-muted);
  font-size: max(21rpx, 12px);
}

.theme-options {
  margin-top: 26rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.theme-option {
  width: 100%;
  min-height: var(--tms-control-height);
  margin: 0;
  padding: 14rpx 18rpx;
  border: 2rpx solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  color: var(--tms-text);
  background: var(--tms-panel);
  display: flex;
  align-items: center;
  gap: 18rpx;
  text-align: left;
  line-height: 1.25;
}

.theme-option::after {
  border: 0;
}

.theme-option--active,
.theme-option:active {
  border-color: var(--tms-primary);
  background: var(--tms-primary-soft);
}

.theme-option:focus-visible {
  outline: 4rpx solid rgba(var(--tms-primary-rgb), 0.35);
  outline-offset: 3rpx;
}

.theme-option__swatch {
  flex: none;
  width: 56rpx;
  height: 56rpx;
  border: 3rpx solid #fff;
  border-radius: 50%;
  background: var(--tms-primary-gradient);
  box-shadow: 0 0 0 1rpx rgba(21, 32, 51, 0.12);
}

.theme-option__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.theme-option__name {
  font-size: max(26rpx, 12px);
  font-weight: 700;
}

.theme-option__description {
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
}

.theme-option__state {
  flex: none;
  color: var(--tms-primary);
  font-size: max(22rpx, 12px);
  font-weight: 700;
}

.settings-page__note {
  display: block;
  margin: 22rpx 6rpx 0;
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
  line-height: 1.5;
}
</style>
