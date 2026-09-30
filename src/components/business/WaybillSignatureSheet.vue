<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getWaybillExecutionContext, signWaybill, uploadWaybillProofFiles } from '@/api/waybill'
import type { Waybill } from '@/api/types'
import { getUserFacingErrorMessage } from '@/api/supabase'
import TmsRecordTimeNotice from '@/components/business/TmsRecordTimeNotice.vue'
import TmsDateTimePicker from '@/components/business/TmsDateTimePicker.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { chooseImages } from '@/utils/file'
import { formatDateTime } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  waybill: Waybill | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const auth = useAuthStore()
const profile = useProfileStore()
const state = reactive({ loading: false, uploading: '', submitting: false, error: '' })
const form = reactive({
  signedAt: Date.now(),
  signerName: '',
  receiptUrls: [] as string[],
  signatureUrls: [] as string[],
  remark: ''
})
const datePickerVisible = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const submitMissing = computed(() => {
  const missing: string[] = []
  if (!form.signerName.trim()) missing.push('签收人')
  if (!form.receiptUrls.length) missing.push('签收回单')
  if (!form.signatureUrls.length) missing.push('签字照片')
  return missing
})
const canSubmit = computed(
  () =>
    submitMissing.value.length === 0 &&
    !state.loading &&
    !state.submitting &&
    !state.uploading
)

watch(
  () => props.modelValue,
  (value) => {
    if (value) void load()
  }
)

async function load() {
  state.error = ''
  if (!props.waybill) {
    state.error = '运单信息不可用，请关闭后重试'
    return
  }
  state.loading = true
  try {
    const context = await getWaybillExecutionContext(auth.token, props.waybill.id)
    const record = context.record
    form.signedAt = record?.signedAt ? new Date(record.signedAt).getTime() : Date.now()
    form.signerName = record?.signerName || props.waybill.receiverName || ''
    form.receiptUrls = [...(record?.receiptUrls || [])]
    form.signatureUrls = [...(record?.signatureUrls || [])]
    form.remark = record?.signatureRemark || ''
  } catch (error) {
    state.error = getUserFacingErrorMessage(error, '签收信息加载失败，请重试')
  } finally {
    state.loading = false
  }
}

async function upload(kind: 'receipt' | 'signature') {
  if (!props.waybill || state.uploading) return
  try {
    const currentCount = kind === 'receipt' ? form.receiptUrls.length : form.signatureUrls.length
    const paths = await chooseImages((kind === 'receipt' ? 5 : 3) - currentCount)
    if (!paths.length) return
    state.uploading = kind
    const operator = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
    const files = await uploadWaybillProofFiles(
      auth.token,
      props.waybill,
      kind === 'receipt' ? 'receipt' : 'signature_confirmation',
      paths,
      operator
    )
    const urls = files.map((item) => item.url)
    if (kind === 'receipt') form.receiptUrls = [...form.receiptUrls, ...urls].slice(0, 5)
    else form.signatureUrls = [...form.signatureUrls, ...urls].slice(0, 3)
  } catch (error) {
    showError(error, '上传失败')
  } finally {
    state.uploading = ''
  }
}

function remove(kind: 'receipt' | 'signature', index: number) {
  const target = kind === 'receipt' ? form.receiptUrls : form.signatureUrls
  target.splice(index, 1)
}

function preview(url: string, urls: string[]) {
  uni.previewImage({ current: url, urls })
}

async function submit() {
  if (!props.waybill || state.submitting) return
  if (!form.signerName.trim()) return void uni.showToast({ title: '请输入签收人', icon: 'none' })
  if (!form.receiptUrls.length) return void uni.showToast({ title: '请上传签收回单', icon: 'none' })
  if (!form.signatureUrls.length)
    return void uni.showToast({ title: '请上传签字确认照片', icon: 'none' })

  state.submitting = true
  try {
    await signWaybill(
      auth.token,
      props.waybill.id,
      new Date(form.signedAt).toISOString(),
      form.signerName.trim(),
      [...form.receiptUrls],
      [...form.signatureUrls],
      form.remark.trim() || null
    )
    uni.showToast({ title: '签收成功', icon: 'success' })
    emit('success')
    visible.value = false
  } catch (error) {
    showError(error, '签收失败')
  } finally {
    state.submitting = false
  }
}

function showError(error: unknown, fallback: string) {
  uni.showToast({
    title: getUserFacingErrorMessage(error, fallback),
    icon: 'none',
    duration: 3000
  })
}
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    safe-area-inset-bottom
    :close-on-click-modal="!state.submitting"
    custom-style="border-radius: 32rpx 32rpx 0 0; overflow: hidden;"
  >
    <view class="signature-sheet">
      <view class="signature-sheet__header">
        <view>
          <text class="signature-sheet__kicker">签收与回单</text>
          <text class="signature-sheet__title">签收确认</text>
          <text class="signature-sheet__subtitle">手机和电脑提交后使用同一份签收记录</text>
        </view>
        <button
          class="signature-sheet__close"
          aria-label="关闭签收确认"
          hover-class="signature-sheet__close--pressed"
          :disabled="state.submitting"
          @click="visible = false"
        >
          <TmsIcon name="close" size="28rpx" />
        </button>
      </view>

      <scroll-view scroll-y class="signature-sheet__body">
        <view v-if="state.loading" class="signature-sheet__loading">
          <view class="signature-sheet__loading-head">
            <wd-loading type="circular" color="var(--tms-primary)" size="36rpx" />
            <text>正在同步签收信息…</text>
          </view>
          <view class="signature-sheet__loading-card"><view /><view /><view /></view>
        </view>
        <view v-else-if="state.error" class="signature-sheet__error">
          <text class="signature-sheet__error-icon">!</text>
          <strong>签收信息加载失败</strong>
          <text>{{ state.error }}</text>
          <button @click="load">重新加载</button>
        </view>
        <template v-else>
          <view class="signature-sheet__notice">
            <TmsIcon name="info" size="32rpx" />
            <text>签收后运单进入“已签收”，还需录入收车时间和里程才算完成。</text>
          </view>
          <TmsRecordTimeNotice class="signature-sheet__time-notice" subject="签收时间" />

          <view class="sheet-field">
            <view class="sheet-field__number">1</view>
            <text class="sheet-field__label">签收时间 <text class="required-mark">*</text></text>
            <wd-cell
              custom-class="tms-date-trigger"
              :value="formatDateTime(new Date(form.signedAt).toISOString())"
              is-link
              aria-label="选择签收时间"
              @click="datePickerVisible = true"
            />
            <TmsDateTimePicker
              v-model="form.signedAt"
              v-model:visible="datePickerVisible"
              title="选择签收时间"
            />
          </view>
          <view class="sheet-field">
            <view class="sheet-field__number">2</view>
            <text class="sheet-field__label">签收人 <text class="required-mark">*</text></text>
            <wd-input
              v-model="form.signerName"
              custom-class="tms-form-input"
              :maxlength="50"
              aria-label="签收人"
              placeholder="请输入实际签收人"
            />
          </view>

          <view v-for="kind in ['receipt', 'signature'] as const" :key="kind" class="sheet-field">
            <view class="sheet-field__number">{{ kind === 'receipt' ? 3 : 4 }}</view>
            <text class="sheet-field__label">
              {{ kind === 'receipt' ? '签收回单' : '签字确认照片' }}
              <text class="required-mark">*</text>
            </text>
            <text class="sheet-field__help">
              {{
                kind === 'receipt'
                  ? '拍摄完整回单，确保单号和签收信息清晰'
                  : '拍摄收货人签字后的确认凭证'
              }}
            </text>
            <view class="sheet-evidence">
              <view
                v-for="(url, index) in kind === 'receipt' ? form.receiptUrls : form.signatureUrls"
                :key="url"
                class="sheet-evidence__item"
              >
                <button
                  class="tms-evidence-preview"
                  :aria-label="`预览第 ${index + 1} 张${kind === 'receipt' ? '签收回单' : '签字照片'}`"
                  @click="preview(url, kind === 'receipt' ? form.receiptUrls : form.signatureUrls)"
                >
                  <image :src="url" mode="aspectFill" />
                </button>
                <button
                  class="tms-evidence-remove"
                  :aria-label="`删除第 ${index + 1} 张${kind === 'receipt' ? '签收回单' : '签字照片'}`"
                  :disabled="state.submitting || !!state.uploading"
                  @click="remove(kind, index)"
                >×</button>
              </view>
              <button
                class="sheet-evidence__add"
                :disabled="!!state.uploading"
                @click="upload(kind)"
              >
                <wd-loading
                  v-if="state.uploading === kind"
                  type="circular"
                  color="var(--tms-primary)"
                  size="28rpx"
                />
                <view v-else class="sheet-evidence__add-content">
                  <TmsIcon name="camera" size="40rpx" />
                  <text>拍照上传</text>
                </view>
              </button>
            </view>
            <text class="sheet-field__quota">
              已上传 {{ kind === 'receipt' ? form.receiptUrls.length : form.signatureUrls.length }}/{{ kind === 'receipt' ? 5 : 3 }} 张
            </text>
          </view>

          <view class="sheet-field">
            <text class="sheet-field__label">备注</text>
            <wd-textarea
              v-model="form.remark"
              custom-class="tms-form-textarea"
              :maxlength="300"
              placeholder="可填写货损、少货或现场说明"
            />
            <text class="sheet-field__count">{{ form.remark.length }}/300</text>
          </view>
        </template>
      </scroll-view>

      <view class="signature-sheet__footer">
        <view class="signature-sheet__completion">
          {{ submitMissing.length ? `还需：${submitMissing.join('、')}` : '签收资料已完整' }}
        </view>
        <wd-button
          class="signature-sheet__cancel"
          custom-class="tms-secondary-action"
          variant="plain"
          type="primary"
          :round="false"
          :disabled="state.submitting"
          @click="visible = false"
        >
          取消
        </wd-button>
        <wd-button
          custom-class="tms-primary-action"
          type="primary"
          :round="false"
          :loading="state.submitting"
          loading-color="#ffffff"
          :disabled="!canSubmit"
          @click="submit"
        >
          确认签收
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.signature-sheet {
  height: min(92vh, 1240rpx);
  height: min(92dvh, 1240rpx);
  background: #f5f7fb;
  display: flex;
  flex-direction: column;
}
.signature-sheet__header {
  position: relative;
  padding: 30rpx 104rpx 24rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #edf0f5;
}
.signature-sheet__kicker,
.signature-sheet__title,
.signature-sheet__subtitle {
  display: block;
}
.signature-sheet__kicker {
  color: var(--tms-primary);
  font-size: max(20rpx, 12px);
  font-weight: 700;
  letter-spacing: 2rpx;
}
.signature-sheet__title {
  margin-top: 5rpx;
  color: var(--tms-text);
  font-size: 36rpx;
  font-weight: 700;
}
.signature-sheet__subtitle {
  margin-top: 7rpx;
  color: var(--tms-muted);
  font-size: max(23rpx, 12px);
}
.signature-sheet__close {
  box-sizing: border-box;
  position: absolute;
  z-index: 2;
  top: 24rpx;
  right: 24rpx;
  width: 56rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid #e7eaf0;
  border-radius: 50%;
  color: #7e8798;
  background: #f1f3f7;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  touch-action: manipulation;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}
.signature-sheet__close::after {
  border: 0;
}
.signature-sheet__close--pressed,
.signature-sheet__close:active {
  color: var(--tms-primary);
  background: #e8ebf3;
  transform: scale(0.94);
}
.signature-sheet__close:focus-visible {
  outline: 4rpx solid rgba(var(--tms-primary-rgb), 0.24);
  outline-offset: 3rpx;
}
.signature-sheet__close[disabled] {
  opacity: 0.5;
}
.signature-sheet__body {
  flex: 1;
  min-height: 0;
}
.signature-sheet__loading {
  min-height: 520rpx;
  padding: 42rpx 26rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  color: var(--tms-muted);
}
.signature-sheet__loading-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.signature-sheet__loading-card {
  width: 100%;
  padding: 26rpx;
  border-radius: 22rpx;
  background: #fff;
}
.signature-sheet__loading-card view {
  height: 74rpx;
  border-radius: 14rpx;
  background: linear-gradient(100deg, #eef1f6 30%, #fafbfc 50%, #eef1f6 70%);
  background-size: 240% 100%;
  animation: sheet-shimmer 1.35s ease-in-out infinite;
}
.signature-sheet__loading-card view + view {
  margin-top: 18rpx;
}
.signature-sheet__error {
  min-height: 520rpx;
  margin: 24rpx 26rpx;
  padding: 54rpx 36rpx;
  border-radius: 22rpx;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.signature-sheet__error-icon {
  width: 70rpx;
  height: 70rpx;
  border-radius: 22rpx;
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 70rpx;
}
.signature-sheet__error strong {
  margin-top: 22rpx;
  color: var(--tms-text);
  font-size: max(28rpx, 12px);
}
.signature-sheet__error > text:last-of-type {
  margin-top: 10rpx;
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
  line-height: 1.6;
}
.signature-sheet__error button {
  min-height: var(--tms-control-height);
  margin-top: 26rpx;
  padding: 0 36rpx;
  border-radius: 999rpx;
  color: #fff;
  background: linear-gradient(135deg, var(--tms-primary), var(--tms-primary-bright));
  font-size: max(24rpx, 12px);
  line-height: var(--tms-control-height);
}
.signature-sheet__notice {
  margin: 22rpx 26rpx 0;
  padding: 20rpx 22rpx;
  color: #3157bd;
  background: #edf3ff;
  border-radius: 16rpx;
  display: flex;
  gap: 12rpx;
  font-size: max(24rpx, 12px);
  line-height: 1.5;
}
.signature-sheet__time-notice {
  margin-right: 26rpx;
  margin-left: 26rpx;
}
.sheet-field {
  position: relative;
  margin: 20rpx 26rpx 0;
  padding: 26rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(46, 61, 93, 0.05);
}
.sheet-field__number {
  position: absolute;
  top: 22rpx;
  right: 24rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 14rpx;
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: max(20rpx, 12px);
  font-weight: 700;
}
.sheet-field__label {
  display: block;
  color: var(--tms-text);
  font-size: max(27rpx, 14px);
  font-weight: 700;
}
.sheet-field__label .required-mark {
  color: #ef4d57;
}
.sheet-field__help {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
}
.sheet-field__quota {
  display: block;
  margin-top: 10rpx;
  color: #8b95a8;
  font-size: max(20rpx, 12px);
  text-align: right;
}
.sheet-field__count {
  position: absolute;
  right: 42rpx;
  bottom: 36rpx;
  color: #9aa2b1;
  font-size: max(21rpx, 12px);
}
.sheet-evidence {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}
.sheet-evidence__item,
.sheet-evidence__add {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border-radius: 18rpx;
}
.sheet-evidence__item image {
  width: 100%;
  height: 100%;
}
.sheet-evidence__add {
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
  border: 2rpx dashed var(--tms-primary-soft-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: max(22rpx, 12px);
  line-height: 1;
}
.sheet-evidence__add::after {
  border: 0;
}
.sheet-evidence__add-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  line-height: 1;
}
.sheet-evidence__add-content text {
  display: block;
  line-height: 1.2;
}
.signature-sheet__footer {
  padding: 20rpx 26rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: grid;
  grid-template-columns: 1fr 1.8fr;
  gap: 18rpx;
  box-shadow: 0 -8rpx 24rpx rgba(37, 48, 73, 0.06);
}
.signature-sheet__completion {
  grid-column: 1 / -1;
  color: #667085;
  font-size: max(21rpx, 12px);
  text-align: center;
}
.signature-sheet__footer :deep(.wd-button) {
  height: var(--tms-control-height);
  border-radius: var(--tms-control-radius);
  font-size: var(--tms-control-font-size);
  font-weight: 700;
}

@keyframes sheet-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
</style>
