<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getUserFacingErrorMessage } from "@/api/supabase";
import {
  completeWaybillExecution,
  getWaybillExecutionContext,
  recordWaybillDeparture,
  uploadWaybillProofFiles,
} from "@/api/waybill";
import type { ExecutionAction } from "@/api/types";
import TmsIcon from "@/components/business/TmsIcon.vue";
import TmsPageSkeleton from "@/components/business/TmsPageSkeleton.vue";
import TmsRecordTimeNotice from "@/components/business/TmsRecordTimeNotice.vue";
import TmsTopBar from "@/components/business/TmsTopBar.vue";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useWaybillStore } from "@/stores/waybill";
import { chooseImages } from "@/utils/file";

const auth = useAuthStore();
const profile = useProfileStore();
const waybill = useWaybillStore();
const id = ref("");
const action = ref<Exclude<ExecutionAction, "signature">>("departure");
const state = reactive({
  loading: false,
  uploading: false,
  submitting: false,
  error: "",
});
const form = reactive({
  occurredAt: Date.now(),
  odometerKm: "",
  photoUrls: [] as string[],
  remark: "",
});
const current = computed(() => waybill.current);
const executionContext =
  ref<Awaited<ReturnType<typeof getWaybillExecutionContext>>>();
const isDeparture = computed(() => action.value === "departure");
const isRepairingReturnArchive = computed(
  () =>
    !isDeparture.value &&
    Boolean(
      executionContext.value?.needsReturnCompletion &&
      current.value?.status === "completed",
    ),
);
const title = computed(() =>
  isDeparture.value
    ? "确认发车"
    : isRepairingReturnArchive.value
      ? "补录回场"
      : "确认回场",
);
const kicker = computed(() =>
  isDeparture.value ? "DEPARTURE RECORD" : "RETURN & CLOSE",
);
const fieldTitle = computed(() =>
  isDeparture.value ? "出车里程（公里）" : "收车里程（公里）",
);
const submitMissing = computed(() => {
  const missing: string[] = [];
  const odometer = Number(form.odometerKm);
  if (form.odometerKm === "" || !Number.isFinite(odometer) || odometer < 0)
    missing.push("里程");
  if (!form.photoUrls.length) missing.push("车辆照片");
  return missing;
});
const canSubmit = computed(
  () =>
    submitMissing.value.length === 0 &&
    !state.loading &&
    !state.submitting &&
    !state.uploading,
);

onLoad((query) => {
  id.value = String(query?.id || "");
  action.value = query?.action === "completion" ? "completion" : "departure";
  void load();
});

async function load() {
  state.error = "";
  if (!id.value) {
    state.error = "缺少运单参数，请返回任务详情后重新进入";
    return;
  }
  state.loading = true;
  try {
    await Promise.all([waybill.loadDetail(id.value), profile.load(true)]);
    const context = await getWaybillExecutionContext(auth.token, id.value);
    executionContext.value = context;
    const record = context.record;
    const time = isDeparture.value ? record?.departureTime : record?.returnTime;
    const odometer = isDeparture.value
      ? record?.departureOdometerKm
      : record?.returnOdometerKm;
    form.occurredAt = time ? new Date(time).getTime() : Date.now();
    form.odometerKm =
      odometer === null || odometer === undefined ? "" : String(odometer);
    form.photoUrls = [
      ...(isDeparture.value
        ? record?.departurePhotoUrls || []
        : record?.returnPhotoUrls || []),
    ];
    form.remark =
      (isDeparture.value
        ? record?.departureRemark
        : record?.completionRemark) || "";
  } catch (error) {
    state.error = getUserFacingErrorMessage(
      error,
      "执行信息加载失败，请稍后重试",
    );
    showError(error, "执行信息加载失败");
  } finally {
    state.loading = false;
  }
}

async function uploadPhotos() {
  if (!current.value || state.uploading) return;
  try {
    const paths = await chooseImages(5 - form.photoUrls.length);
    if (!paths.length) return;
    state.uploading = true;
    const operator =
      profile.driver?.driverName ||
      profile.user?.nickName ||
      profile.user?.userName;
    const files = await uploadWaybillProofFiles(
      auth.token,
      current.value,
      isDeparture.value ? "departure" : "return",
      paths,
      operator,
    );
    form.photoUrls = [
      ...form.photoUrls,
      ...files.map((item) => item.url),
    ].slice(0, 5);
  } catch (error) {
    showError(error, "照片上传失败");
  } finally {
    state.uploading = false;
  }
}

function removePhoto(index: number) {
  form.photoUrls.splice(index, 1);
}

function preview(url: string) {
  uni.previewImage({ current: url, urls: form.photoUrls });
}

async function submit() {
  const odometer = Number(form.odometerKm);
  if (!Number.isFinite(odometer) || odometer < 0)
    return void uni.showToast({
      title: `请输入正确的${fieldTitle.value}`,
      icon: "none",
    });
  if (!form.photoUrls.length)
    return void uni.showToast({
      title: `请上传${isDeparture.value ? "发车" : "收车"}照片`,
      icon: "none",
    });
  if (!isDeparture.value) {
    const departureOdometer = Number(
      executionContext.value?.record?.departureOdometerKm ?? 0,
    );
    if (odometer < departureOdometer) {
      return void uni.showToast({
        title: `收车里程不能小于出车里程 ${departureOdometer} 公里`,
        icon: "none",
        duration: 3000,
      });
    }
  }
  state.submitting = true;
  try {
    if (isDeparture.value) {
      await recordWaybillDeparture(
        auth.token,
        id.value,
        new Date(form.occurredAt).toISOString(),
        odometer,
        [...form.photoUrls],
        form.remark.trim() || null,
      );
    } else {
      await completeWaybillExecution(
        auth.token,
        id.value,
        new Date(form.occurredAt).toISOString(),
        odometer,
        [...form.photoUrls],
        form.remark.trim() || null,
      );
    }
    uni.showToast({ title: `${title.value}成功`, icon: "success" });
    setTimeout(() => uni.navigateBack(), 450);
  } catch (error) {
    showError(error, "提交失败");
  } finally {
    state.submitting = false;
  }
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
  <view class="execution-page page">
    <view class="execution-page__hero">
      <TmsTopBar :title="title" show-back />
      <view class="execution-page__hero-main">
        <view class="execution-page__icon"
          ><TmsIcon :name="isDeparture ? 'vehicle' : 'check'" size="46rpx"
        /></view>
        <view>
          <text class="execution-page__kicker">{{ kicker }}</text>
          <text class="execution-page__title">{{
            current?.waybillNo || "运输运单"
          }}</text>
          <text class="execution-page__subtitle">
            {{
              isDeparture
                ? "记录发车时间、出车里程和车辆照片"
                : isRepairingReturnArchive
                  ? "补齐历史缺失的收车时间、里程和车辆照片"
                  : "记录收车时间、收车里程并完成运输闭环"
            }}
          </text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="execution-page__scroll">
      <TmsPageSkeleton
        v-if="state.loading || state.error"
        :label="`正在加载${isDeparture ? '发车' : '收车'}记录…`"
        :error="state.error"
        @retry="load"
      />
      <view v-else class="execution-page__content">
        <view
          class="execution-page__notice"
          :class="{
            'execution-page__notice--warning': isRepairingReturnArchive,
          }"
        >
          <wd-icon name="info-circle" size="32rpx" />
          <text>{{
            isDeparture
              ? "出车里程会和收车里程配对，自动计算本次行驶公里数。发车时间支持按实际情况补录。"
              : isRepairingReturnArchive
                ? "系统检测到历史完成状态缺少回场档案。本次提交会补齐回场记录和车辆里程台账。"
                : `收车里程不得小于出车里程 ${executionContext?.record?.departureOdometerKm ?? 0} 公里；时间可按实际情况补录。`
          }}</text>
        </view>
        <TmsRecordTimeNotice :subject="isDeparture ? '发车时间' : '收车时间'" />
        <view class="form-card card">
          <view class="form-card__heading">
            <view class="form-card__step">1</view>
            <view
              ><strong>记录车辆状态</strong
              ><text>请以现场实际信息为准</text></view
            >
          </view>
          <view class="field-block">
            <text class="field-block__label"
              >{{ isDeparture ? "实际发车时间" : "收车时间"
              }}<text class="required-mark">*</text></text
            >
            <wd-datetime-picker
              v-model="form.occurredAt"
              type="datetime"
              :title="`选择${isDeparture ? '发车' : '收车'}时间`"
            />
          </view>
          <view class="field-block">
            <text class="field-block__label"
              >{{ fieldTitle }}<text class="required-mark">*</text></text
            >
            <view class="mileage-input"
              ><input
                v-model="form.odometerKm"
                type="digit"
                placeholder="请输入仪表盘公里数"
              /><text>km</text></view
            >
          </view>
          <view class="field-block">
            <text class="field-block__label"
              >{{ isDeparture ? "发车照片" : "收车照片"
              }}<text class="required-mark">*</text></text
            >
            <text class="field-block__help"
              >拍摄车辆外观和仪表盘，确保车牌及里程清晰</text
            >
            <view class="evidence-grid">
              <view
                v-for="(url, index) in form.photoUrls"
                :key="url"
                class="evidence-grid__item"
              >
                <image :src="url" mode="aspectFill" @click="preview(url)" />
                <button
                  class="evidence-grid__remove"
                  @click="removePhoto(index)"
                >
                  ×
                </button>
              </view>
              <button
                v-if="form.photoUrls.length < 5"
                class="evidence-grid__add"
                :disabled="state.uploading"
                @click="uploadPhotos"
              >
                <wd-loading
                  v-if="state.uploading"
                  type="ring"
                  color="#3763f4"
                  size="30rpx"
                />
                <view v-else class="evidence-grid__add-content">
                  <wd-icon name="camera" size="42rpx" />
                  <text>拍照上传</text>
                </view>
              </button>
            </view>
            <text class="field-block__quota"
              >已上传 {{ form.photoUrls.length }}/5 张</text
            >
          </view>
          <view class="field-block field-block--remark">
            <text class="field-block__label">备注</text>
            <textarea
              v-model="form.remark"
              maxlength="300"
              placeholder="可填写现场说明"
            />
            <text class="field-block__count">{{ form.remark.length }}/300</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view
      v-if="!state.loading && !state.error"
      class="execution-footer safe-bottom"
    >
      <view
        ><text>{{
          submitMissing.length
            ? `还需补充：${submitMissing.join("、")}`
            : "信息已完整，请核对后提交"
        }}</text
        ><strong>{{
          submitMissing.length ? "请完成必填项" : title
        }}</strong></view
      >
      <wd-button
        custom-class="tms-primary-action"
        type="primary"
        :round="false"
        :loading="state.submitting"
        loading-color="#fff"
        :disabled="!canSubmit"
        @click="submit"
        >{{ title }}</wd-button
      >
    </view>
  </view>
</template>

<style scoped lang="scss">
.execution-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--tms-bg);
  display: flex;
  flex-direction: column;
}
.execution-page__hero {
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(145deg, #315bef, #4978ff);
}
.execution-page__hero-main {
  padding: 22rpx 30rpx 34rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.14);
}
.execution-page__icon {
  width: 82rpx;
  height: 82rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.execution-page__kicker,
.execution-page__title,
.execution-page__subtitle {
  display: block;
}
.execution-page__kicker {
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  opacity: 0.8;
}
.execution-page__title {
  margin-top: 5rpx;
  font-size: 32rpx;
  font-weight: 900;
}
.execution-page__subtitle {
  margin-top: 7rpx;
  font-size: 23rpx;
  opacity: 0.86;
}
.execution-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}
.execution-page__content {
  padding: 24rpx 28rpx 50rpx;
}
.execution-page__notice {
  padding: 20rpx 22rpx;
  color: #3157bd;
  background: #edf3ff;
  border-radius: 16rpx;
  display: flex;
  gap: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
}
.execution-page__notice--warning {
  color: #9a5b08;
  background: #fff7e8;
}
.form-card {
  margin-top: 20rpx;
  padding: 30rpx 28rpx;
  border-radius: 20rpx;
}
.form-card__heading {
  margin-bottom: 30rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #edf0f5;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.form-card__step {
  width: 50rpx;
  height: 50rpx;
  border-radius: 16rpx;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
}
.form-card__heading strong,
.form-card__heading text {
  display: block;
}
.form-card__heading strong {
  color: var(--tms-text);
  font-size: 27rpx;
}
.form-card__heading text {
  margin-top: 4rpx;
  color: var(--tms-muted);
  font-size: 21rpx;
}
.field-block + .field-block {
  margin-top: 34rpx;
}
.field-block {
  position: relative;
}
.field-block__label {
  display: block;
  color: var(--tms-text);
  font-size: 27rpx;
  font-weight: 800;
}
.field-block__label .required-mark {
  color: #ef4d57;
}
.field-block__help {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: 22rpx;
}
.field-block__quota {
  display: block;
  margin-top: 10rpx;
  color: #8b95a8;
  font-size: 20rpx;
  text-align: right;
}
.mileage-input {
  height: 80rpx;
  margin-top: 14rpx;
  padding: 0 20rpx;
  background: #f6f8fb;
  border: 1rpx solid #e5e9f0;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
}
.mileage-input input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 700;
}
.mileage-input text {
  color: var(--tms-muted);
  font-size: 24rpx;
}
.evidence-grid {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}
.evidence-grid__item,
.evidence-grid__add {
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
.evidence-grid__item image {
  width: 100%;
  height: 100%;
}
.evidence-grid__remove {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 38rpx;
  height: 38rpx;
  padding: 0;
  color: #fff;
  background: rgba(16, 24, 40, 0.72);
  border: 0;
  border-radius: 50%;
  line-height: 34rpx;
}
.evidence-grid__add {
  color: var(--tms-primary);
  background: #f4f7ff;
  border: 2rpx dashed #b8c7f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  line-height: 1;
}
.evidence-grid__add::after {
  border: 0;
}
.evidence-grid__add-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  line-height: 1;
}
.evidence-grid__add-content :deep(.wd-icon) {
  display: flex;
  line-height: 1;
}
.evidence-grid__add-content text {
  display: block;
  line-height: 1.2;
}
.field-block textarea {
  box-sizing: border-box;
  width: 100%;
  height: 150rpx;
  margin-top: 14rpx;
  padding: 18rpx 18rpx 48rpx;
  background: #f6f8fb;
  border-radius: 16rpx;
  font-size: 25rpx;
}
.field-block__count {
  position: absolute;
  right: 16rpx;
  bottom: 14rpx;
  color: #9aa2b1;
  font-size: 21rpx;
}
.execution-footer {
  flex: 0 0 auto;
  min-height: 126rpx;
  padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  box-shadow: 0 -8rpx 24rpx rgba(37, 48, 73, 0.06);
}
.execution-footer text,
.execution-footer strong {
  display: block;
}
.execution-footer text {
  color: var(--tms-muted);
  font-size: 22rpx;
}
.execution-footer strong {
  margin-top: 4rpx;
  color: var(--tms-text);
  font-size: 27rpx;
}
.execution-footer :deep(.wd-button) {
  flex: 0 0 330rpx;
}
</style>
