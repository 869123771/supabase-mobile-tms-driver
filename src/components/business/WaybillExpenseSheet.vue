<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  getDriverExpenseObjectPath,
  removeDriverExpenseFiles,
  submitDriverExpense,
  uploadDriverExpenseFiles,
} from "@/api/expense";
import { getUserFacingErrorMessage } from "@/api/supabase";
import type {
  DriverExpenseItem,
  DriverExpenseRecord,
  DriverExpenseWaybill,
} from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { chooseImages } from "@/utils/file";
import { getCurrentGcj02Location } from "@/utils/location";

interface ExpenseAttachmentDraft {
  id: string;
  src: string;
  remoteUrl?: string;
  localPath?: string;
}

const props = defineProps<{
  modelValue: boolean;
  waybill: DriverExpenseWaybill | null;
  expenseItems: DriverExpenseItem[];
  record?: DriverExpenseRecord | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  success: [costId: string];
}>();

const auth = useAuthStore();
const state = reactive({
  choosing: false,
  locating: false,
  uploading: false,
  submitting: false,
});
const form = reactive({
  expenseItemId: "",
  amount: "",
  occurredAt: Date.now(),
  providerName: "",
  paymentChannel: "",
  invoiceNo: "",
  expenseLocation: "",
  longitude: null as number | null,
  latitude: null as number | null,
  remark: "",
});
const attachments = ref<ExpenseAttachmentDraft[]>([]);
const initialRemoteUrls = ref<string[]>([]);
const idempotencyKey = ref("");

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
const isEditing = computed(() => Boolean(props.record));
const expenseItemLabels = computed(() =>
  props.expenseItems.map((item) =>
    item.parentName ? `${item.parentName} · ${item.itemName}` : item.itemName,
  ),
);
const expenseItemIndex = computed(() =>
  Math.max(
    0,
    props.expenseItems.findIndex((item) => item.id === form.expenseItemId),
  ),
);
const selectedExpenseItem = computed(() =>
  props.expenseItems.find((item) => item.id === form.expenseItemId),
);
const missingFields = computed(() => {
  const missing: string[] = [];
  const amount = Number(form.amount);
  if (!form.expenseItemId) missing.push("费用项目");
  if (!Number.isFinite(amount) || amount <= 0) missing.push("金额");
  if (!attachments.value.length) missing.push("费用凭证");
  return missing;
});
const busy = computed(
  () =>
    state.choosing ||
    state.locating ||
    state.uploading ||
    state.submitting,
);
const canSubmit = computed(
  () => missingFields.value.length === 0 && !busy.value,
);

watch(
  () => props.modelValue,
  (value) => {
    if (value) resetForm();
  },
);

function createIdempotencyKey() {
  return `driver-expense-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function resetForm() {
  const record = props.record;
  form.expenseItemId = record?.expenseItemId || "";
  form.amount = record ? String(record.amount) : "";
  form.occurredAt = record?.occurredOn
    ? new Date(`${record.occurredOn}T00:00:00`).getTime()
    : Date.now();
  form.providerName = record?.providerName || record?.payeeName || "";
  form.paymentChannel = record?.paymentChannel || "";
  form.invoiceNo = record?.invoiceNo || "";
  form.expenseLocation = record?.expenseLocation || "";
  form.longitude = null;
  form.latitude = null;
  form.remark = record?.remark || "";
  initialRemoteUrls.value = [...(record?.attachments || [])];
  attachments.value = initialRemoteUrls.value.map((url, index) => ({
    id: `remote-${index}-${url}`,
    src: url,
    remoteUrl: url,
  }));
  idempotencyKey.value = createIdempotencyKey();
}

function changeExpenseItem(event: { detail: { value: string | number } }) {
  const index = Number(event.detail.value);
  form.expenseItemId = props.expenseItems[index]?.id || "";
}

async function addAttachments() {
  if (busy.value || attachments.value.length >= 5) return;
  state.choosing = true;
  try {
    const paths = await chooseImages(5 - attachments.value.length);
    const next = paths.map((path, index) => ({
      id: `local-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      src: path,
      localPath: path,
    }));
    attachments.value = [...attachments.value, ...next].slice(0, 5);
  } catch (error) {
    showError(error, "选择费用凭证失败");
  } finally {
    state.choosing = false;
  }
}

function removeAttachment(index: number) {
  if (busy.value) return;
  attachments.value.splice(index, 1);
}

function previewAttachment(index: number) {
  const urls = attachments.value.map((item) => item.src);
  uni.previewImage({ current: urls[index], urls });
}

async function locateExpense() {
  if (busy.value) return;
  state.locating = true;
  try {
    const location = await getCurrentGcj02Location(
      form.expenseLocation || undefined,
    );
    form.longitude = location.longitude;
    form.latitude = location.latitude;
    uni.showToast({ title: "位置已记录", icon: "success" });
  } catch (error) {
    showError(error, "定位失败，请手动填写地点");
  } finally {
    state.locating = false;
  }
}

function formatLocalDate(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function submit() {
  if (!props.waybill || !auth.user?.id || !canSubmit.value) return;
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    uni.showToast({ title: "请输入正确的费用金额", icon: "none" });
    return;
  }

  const localPaths = attachments.value
    .map((item) => item.localPath)
    .filter((path): path is string => Boolean(path));
  let uploaded: Awaited<ReturnType<typeof uploadDriverExpenseFiles>> = [];
  state.submitting = true;
  try {
    if (localPaths.length) {
      state.uploading = true;
      uploaded = await uploadDriverExpenseFiles(
        auth.token,
        auth.user.id,
        props.waybill.id,
        localPaths,
      );
      state.uploading = false;
    }

    const retainedRemoteUrls = attachments.value
      .map((item) => item.remoteUrl)
      .filter((url): url is string => Boolean(url));
    const finalUrls = [
      ...retainedRemoteUrls,
      ...uploaded.map((item) => item.url),
    ];
    const payload = {
      waybillId: props.waybill.id,
      expenseItemId: form.expenseItemId,
      amount,
      occurredOn: formatLocalDate(form.occurredAt),
      attachments: finalUrls,
      idempotencyKey: idempotencyKey.value,
      costId: props.record?.id || null,
      providerName: form.providerName.trim() || null,
      payeeName: form.providerName.trim() || null,
      paymentChannel: form.paymentChannel.trim() || null,
      invoiceNo: form.invoiceNo.trim() || null,
      expenseLocation: form.expenseLocation.trim() || null,
      expenseLongitude: form.longitude,
      expenseLatitude: form.latitude,
      expenseCoordinateSystem:
        form.longitude === null || form.latitude === null ? null : "gcj02",
      remark: form.remark.trim() || null,
    } as const;
    let costId: string;
    try {
      costId = await submitDriverExpense(auth.token, payload);
    } catch (firstError) {
      // The RPC is idempotent. A single retry prevents a committed financial
      // record from losing its uploaded receipts after a late network timeout.
      try {
        costId = await submitDriverExpense(auth.token, payload);
      } catch {
        throw firstError;
      }
    }

    const retained = new Set(retainedRemoteUrls);
    const removedPaths = initialRemoteUrls.value
      .filter((url) => !retained.has(url))
      .map(getDriverExpenseObjectPath)
      .filter((path): path is string => Boolean(path));
    if (removedPaths.length) {
      try {
        await removeDriverExpenseFiles(auth.token, removedPaths);
      } catch (cleanupError) {
        console.warn("failed to clean up replaced expense files", cleanupError);
      }
    }

    uni.showToast({
      title: isEditing.value ? "已重新提交审批" : "费用已提交审批",
      icon: "success",
    });
    emit("success", costId);
    visible.value = false;
  } catch (error) {
    if (uploaded.length) {
      try {
        await removeDriverExpenseFiles(
          auth.token,
          uploaded.map((item) => item.objectPath),
        );
      } catch (cleanupError) {
        console.warn("failed to clean up rejected expense uploads", cleanupError);
      }
    }
    showError(error, "费用提交失败，请稍后重试");
  } finally {
    state.uploading = false;
    state.submitting = false;
  }
}

function close() {
  if (!busy.value) visible.value = false;
}

function showError(error: unknown, fallback: string) {
  uni.showToast({
    title: getUserFacingErrorMessage(error, fallback),
    icon: "none",
    duration: 3000,
  });
}
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    safe-area-inset-bottom
    :close-on-click-modal="!busy"
    custom-style="border-radius: 32rpx 32rpx 0 0; overflow: hidden;"
  >
    <view class="expense-sheet">
      <view class="expense-sheet__header">
        <view>
          <text class="expense-sheet__kicker">WAYBILL EXPENSE</text>
          <text class="expense-sheet__title">{{
            isEditing ? "修改费用上报" : "新增费用上报"
          }}</text>
          <text class="expense-sheet__subtitle">
            提交后进入 Web 端同一套财务审批流程
          </text>
        </view>
        <button
          class="expense-sheet__close"
          aria-label="关闭费用上报"
          hover-class="expense-sheet__close--pressed"
          :disabled="busy"
          @click="close"
        >
          <wd-icon name="close" size="28rpx" />
        </button>
      </view>

      <scroll-view scroll-y class="expense-sheet__body">
        <view v-if="record?.reviewRemark" class="expense-sheet__reject-note">
          <wd-icon name="warning" size="32rpx" />
          <view>
            <strong>审批驳回说明</strong>
            <text>{{ record.reviewRemark }}</text>
          </view>
        </view>

        <view class="expense-sheet__notice">
          <wd-icon name="info-circle" size="32rpx" />
          <text>请按实际发生金额填写，并上传清晰、完整的票据或付款凭证。</text>
        </view>

        <view class="expense-field">
          <view class="expense-field__number">1</view>
          <text class="expense-field__label">
            费用项目 <text class="required-mark">*</text>
          </text>
          <picker
            mode="selector"
            :range="expenseItemLabels"
            :value="expenseItemIndex"
            @change="changeExpenseItem"
          >
            <view
              class="expense-field__picker"
              :class="{ 'expense-field__picker--placeholder': !selectedExpenseItem }"
            >
              <text>{{
                selectedExpenseItem
                  ? `${selectedExpenseItem.parentName ? `${selectedExpenseItem.parentName} · ` : ""}${selectedExpenseItem.itemName}`
                  : "请选择费用项目"
              }}</text>
              <wd-icon name="arrow-down" size="28rpx" />
            </view>
          </picker>
        </view>

        <view class="expense-field expense-field--split">
          <view class="expense-field__number">2</view>
          <view class="expense-field__column">
            <text class="expense-field__label">
              金额（元） <text class="required-mark">*</text>
            </text>
            <view class="expense-field__money">
              <text>¥</text>
              <input
                v-model="form.amount"
                type="digit"
                maxlength="12"
                aria-label="费用金额"
                placeholder="0.00"
              />
            </view>
          </view>
          <view class="expense-field__column">
            <text class="expense-field__label">
              发生日期 <text class="required-mark">*</text>
            </text>
            <wd-datetime-picker
              v-model="form.occurredAt"
              type="date"
              title="选择费用发生日期"
              :max-date="Date.now()"
            />
          </view>
        </view>

        <view class="expense-field">
          <view class="expense-field__number">3</view>
          <text class="expense-field__label">
            费用凭证 <text class="required-mark">*</text>
          </text>
          <text class="expense-field__help">支持票据、付款截图或现场凭证，最多 5 张</text>
          <view class="expense-evidence">
            <view
              v-for="(attachment, index) in attachments"
              :key="attachment.id"
              class="expense-evidence__item"
            >
              <image
                :src="attachment.src"
                mode="aspectFill"
                @click="previewAttachment(index)"
              />
              <button
                class="expense-evidence__remove"
                :aria-label="`删除第 ${index + 1} 张费用凭证`"
                :disabled="busy"
                @click="removeAttachment(index)"
              >
                <wd-icon name="close" size="24rpx" />
              </button>
            </view>
            <button
              v-if="attachments.length < 5"
              class="expense-evidence__add"
              aria-label="添加费用凭证"
              :disabled="busy"
              @click="addAttachments"
            >
              <wd-loading
                v-if="state.choosing"
                type="ring"
                color="#4f46e5"
                size="30rpx"
              />
              <view v-else>
                <wd-icon name="camera" size="42rpx" />
                <text>拍照上传</text>
              </view>
            </button>
          </view>
          <text class="expense-field__quota">{{ attachments.length }}/5 张</text>
        </view>

        <view class="expense-field">
          <view class="expense-field__number">4</view>
          <text class="expense-field__label">补充信息</text>
          <view class="expense-field__input-grid">
            <label>
              <text>商户 / 收款方</text>
              <input
                v-model="form.providerName"
                maxlength="100"
                placeholder="可选填"
              />
            </label>
            <label>
              <text>支付方式</text>
              <input
                v-model="form.paymentChannel"
                maxlength="50"
                placeholder="如微信、现金、ETC"
              />
            </label>
            <label>
              <text>发票号码</text>
              <input
                v-model="form.invoiceNo"
                maxlength="100"
                placeholder="可选填"
              />
            </label>
          </view>
          <view class="expense-field__location-row">
            <input
              v-model="form.expenseLocation"
              maxlength="300"
              aria-label="费用发生地点"
              placeholder="费用发生地点（可选）"
            />
            <button
              aria-label="记录当前位置"
              :disabled="busy"
              @click="locateExpense"
            >
              <wd-loading
                v-if="state.locating"
                type="ring"
                color="#4f46e5"
                size="24rpx"
              />
              <wd-icon v-else name="location" size="26rpx" />
              <text>{{ state.locating ? "定位中" : "当前位置" }}</text>
            </button>
          </view>
          <textarea
            v-model="form.remark"
            maxlength="500"
            aria-label="费用说明"
            placeholder="补充费用原因、行程或异常说明（可选）"
          />
          <text class="expense-field__count">{{ form.remark.length }}/500</text>
        </view>
        <view class="expense-sheet__body-space" />
      </scroll-view>

      <view class="expense-sheet__footer">
        <text class="expense-sheet__completion">
          {{
            missingFields.length
              ? `还需补充：${missingFields.join("、")}`
              : "资料已完整，提交后进入财务审批"
          }}
        </text>
        <wd-button
          custom-class="tms-secondary-action"
          plain
          type="primary"
          :round="false"
          :disabled="busy"
          @click="close"
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
          {{ state.uploading ? "正在上传凭证" : isEditing ? "重新提交" : "提交审批" }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.expense-sheet {
  height: min(94vh, 1320rpx);
  height: min(94dvh, 1320rpx);
  overflow: hidden;
  background: #f4f6fa;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
}

.expense-sheet__header {
  position: relative;
  flex: 0 0 auto;
  padding: 30rpx 108rpx 24rpx 30rpx;
  border-bottom: 1rpx solid #e9edf3;
  background: #fff;
}

.expense-sheet__kicker,
.expense-sheet__title,
.expense-sheet__subtitle {
  display: block;
}

.expense-sheet__kicker {
  color: var(--tms-primary);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.expense-sheet__title {
  margin-top: 5rpx;
  color: var(--tms-text);
  font-size: 36rpx;
  font-weight: 900;
}

.expense-sheet__subtitle {
  margin-top: 7rpx;
  color: var(--tms-muted);
  font-size: 23rpx;
}

.expense-sheet__close {
  box-sizing: border-box;
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  width: 56rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid #e4e8ef;
  border-radius: 50%;
  color: #747f91;
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

.expense-sheet__close::after,
.expense-evidence button::after,
.expense-field__location-row button::after {
  border: 0;
}

.expense-sheet__close--pressed,
.expense-sheet__close:active {
  color: var(--tms-primary);
  background: #e8ebf3;
  transform: scale(0.94);
}

.expense-sheet__close:focus-visible,
.expense-evidence button:focus-visible,
.expense-field__location-row button:focus-visible {
  outline: 4rpx solid rgba(79, 70, 229, 0.24);
  outline-offset: 3rpx;
}

.expense-sheet__body {
  flex: 1;
  min-height: 0;
}

.expense-sheet__notice,
.expense-sheet__reject-note {
  margin: 22rpx 26rpx 0;
  padding: 20rpx 22rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  font-size: 23rpx;
  line-height: 1.55;
}

.expense-sheet__notice {
  color: #3157bd;
  background: #edf3ff;
}

.expense-sheet__reject-note {
  color: #b42318;
  background: #fff1f0;
}

.expense-sheet__reject-note view,
.expense-sheet__reject-note strong,
.expense-sheet__reject-note text {
  min-width: 0;
  display: block;
}

.expense-sheet__reject-note text {
  margin-top: 4rpx;
}

.expense-field {
  position: relative;
  margin: 20rpx 26rpx 0;
  padding: 26rpx;
  border: 1rpx solid rgba(226, 231, 239, 0.9);
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(46, 61, 93, 0.05);
}

.expense-field__number {
  position: absolute;
  top: 22rpx;
  right: 24rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 14rpx;
  color: var(--tms-primary);
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 900;
}

.expense-field__label {
  display: block;
  color: var(--tms-text);
  font-size: 27rpx;
  font-weight: 800;
}

.expense-field__help {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: 22rpx;
}

.expense-field__picker,
.expense-field__money,
.expense-field__input-grid input,
.expense-field__location-row,
.expense-field textarea {
  box-sizing: border-box;
  border: 1rpx solid #e5eaf1;
  border-radius: 16rpx;
  background: #f6f8fb;
}

.expense-field__picker {
  min-height: 82rpx;
  margin-top: 16rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  color: var(--tms-text);
  font-size: 26rpx;
  font-weight: 700;
}

.expense-field__picker text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-field__picker--placeholder {
  color: #9aa5b7;
  font-weight: 500;
}

.expense-field--split {
  padding-right: 26rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.expense-field__column {
  min-width: 0;
}

.expense-field__money {
  height: 82rpx;
  margin-top: 16rpx;
  padding: 0 18rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.expense-field__money > text {
  color: var(--tms-primary);
  font-size: 28rpx;
  font-weight: 900;
}

.expense-field__money input {
  min-width: 0;
  flex: 1;
  font-size: 28rpx;
  font-weight: 800;
}

.expense-field--split :deep(.wd-picker) {
  margin-top: 16rpx;
}

.expense-evidence {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.expense-evidence__item,
.expense-evidence__add {
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

.expense-evidence__item image {
  width: 100%;
  height: 100%;
}

.expense-evidence__remove {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 48rpx;
  height: 48rpx;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(17, 24, 39, 0.76);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.expense-evidence__add {
  color: var(--tms-primary);
  border: 2rpx dashed #b8c7f5;
  background: #f4f7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.expense-evidence__add > view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.expense-field__quota {
  display: block;
  margin-top: 10rpx;
  color: #8b95a8;
  font-size: 20rpx;
  text-align: right;
}

.expense-field__input-grid {
  margin-top: 16rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.expense-field__input-grid label:last-child {
  grid-column: 1 / -1;
}

.expense-field__input-grid label > text {
  display: block;
  margin-bottom: 8rpx;
  color: var(--tms-muted);
  font-size: 21rpx;
  font-weight: 600;
}

.expense-field__input-grid input {
  height: 76rpx;
  padding: 0 16rpx;
  font-size: 24rpx;
}

.expense-field__location-row {
  height: 78rpx;
  margin-top: 16rpx;
  padding-left: 16rpx;
  display: flex;
  align-items: center;
}

.expense-field__location-row input {
  min-width: 0;
  flex: 1;
  font-size: 24rpx;
}

.expense-field__location-row button {
  height: 64rpx;
  margin: 0 6rpx;
  padding: 0 16rpx;
  border: 0;
  border-radius: 13rpx;
  color: var(--tms-primary);
  background: #e9edff;
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1;
}

.expense-field textarea {
  width: 100%;
  height: 150rpx;
  margin-top: 16rpx;
  padding: 18rpx 18rpx 46rpx;
  font-size: 24rpx;
}

.expense-field__count {
  position: absolute;
  right: 42rpx;
  bottom: 38rpx;
  color: #9aa5b7;
  font-size: 20rpx;
}

.expense-sheet__body-space {
  height: 30rpx;
}

.expense-sheet__footer {
  flex: 0 0 auto;
  padding: 18rpx 26rpx calc(18rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: grid;
  grid-template-columns: 1fr 1.8fr;
  gap: 16rpx;
  box-shadow: 0 -8rpx 24rpx rgba(37, 48, 73, 0.07);
}

.expense-sheet__completion {
  grid-column: 1 / -1;
  color: var(--tms-muted);
  font-size: 21rpx;
  text-align: center;
}

@media screen and (max-width: 360px) {
  .expense-field--split,
  .expense-field__input-grid {
    grid-template-columns: 1fr;
  }

  .expense-field__input-grid label:last-child {
    grid-column: auto;
  }
}
</style>
