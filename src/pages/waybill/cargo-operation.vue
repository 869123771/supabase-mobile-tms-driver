<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getUserFacingErrorMessage } from "@/api/supabase";
import TmsTopBar from "@/components/business/TmsTopBar.vue";
import TmsIcon from "@/components/business/TmsIcon.vue";
import TmsPageSkeleton from "@/components/business/TmsPageSkeleton.vue";
import {
  analyzeCargoWeighbridgeTicket,
  checkInCargoOperation,
  completeCargoOperation,
  getCargoOperationContext,
  uploadWaybillProofFiles,
} from "@/api/waybill";
import type {
  CargoOperationContext,
  CargoOperationLocation,
  CargoOperationRecognitionPayload,
  CargoOperationType,
  Waybill,
} from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useWaybillStore } from "@/stores/waybill";
import { chooseImages } from "@/utils/file";
import { formatDateTime } from "@/utils/format";
import {
  calculateDistanceMeters,
  getCurrentGcj02Location,
} from "@/utils/location";

interface OperationForm {
  grossWeightTon: string;
  tareWeightTon: string;
  weightTon: string;
  photoUrls: string[];
  weighbridgeTicketUrls: string[];
  recognitionInfo: string;
  recognitionPayload: CargoOperationRecognitionPayload | null;
  remark: string;
}

const waybillStore = useWaybillStore();
const auth = useAuthStore();
const profile = useProfileStore();
const id = ref("");
const operationType = ref<CargoOperationType>("loading");
const checkinOnly = ref(false);
const context = ref<CargoOperationContext | null>(null);
const current = ref<Waybill | null>(null);
const state = reactive({
  loading: false,
  locating: false,
  submitting: false,
  analyzing: false,
  uploading: "",
  error: "",
});
const form = reactive<OperationForm>({
  grossWeightTon: "",
  tareWeightTon: "",
  weightTon: "",
  photoUrls: [],
  weighbridgeTicketUrls: [],
  recognitionInfo: "",
  recognitionPayload: null,
  remark: "",
});

const title = computed(() =>
  operationType.value === "loading" ? "装货" : "卸货",
);
const pageTitle = computed(() =>
  checkinOnly.value ? "确认到达" : `${title.value}打卡`,
);
const address = computed(() => {
  if (!current.value) return "--";
  return operationType.value === "loading"
    ? current.value.shipperAddress
    : current.value.receiverAddress;
});
const isCompleted = computed(
  () => context.value?.operation?.operationStatus === "completed",
);
const submitMissing = computed(() => {
  const missing: string[] = [];
  if (!form.weightTon || Number(form.weightTon) <= 0) missing.push(`${title.value}净重`);
  if (form.grossWeightTon && Number(form.grossWeightTon) <= 0) missing.push("毛重格式");
  if (form.tareWeightTon && Number(form.tareWeightTon) <= 0) missing.push("皮重格式");
  if (
    Number(form.grossWeightTon) > 0 &&
    Number(form.tareWeightTon) > 0 &&
    Number(form.grossWeightTon) < Number(form.tareWeightTon)
  ) {
    missing.push("毛重应不小于皮重");
  }
  if (!form.photoUrls.length) missing.push(`${title.value}照片`);
  if (!form.weighbridgeTicketUrls.length) missing.push("磅单");
  return missing;
});
const canSubmit = computed(
  () =>
    Boolean(context.value?.operation) &&
    submitMissing.value.length === 0 &&
    !state.submitting &&
    !state.analyzing &&
    !state.uploading,
);
const calculatedNetWeight = computed(() => {
  const gross = Number(form.grossWeightTon);
  const tare = Number(form.tareWeightTon);
  if (!Number.isFinite(gross) || !Number.isFinite(tare) || gross <= 0 || tare <= 0) {
    return null;
  }
  return Math.max(0, Number((gross - tare).toFixed(3)));
});
const weightDifferenceWarning = computed(() => {
  const calculated = calculatedNetWeight.value;
  const net = Number(form.weightTon);
  if (calculated === null || !Number.isFinite(net) || net <= 0) return "";
  const difference = Math.abs(calculated - net);
  return difference > 0.05
    ? `毛重减皮重为 ${calculated} 吨，与填写净重相差 ${difference.toFixed(3)} 吨，请核对扣水、扣杂等业务数据。`
    : "";
});
const recognitionConfidence = computed(() => {
  const value = Number(form.recognitionPayload?.confidence);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
});
const recognitionWarnings = computed(() => form.recognitionPayload?.warnings || []);
const recognitionIsStale = computed(() => {
  const source = form.recognitionPayload?.ticketUrls || [];
  if (!source.length || !form.weighbridgeTicketUrls.length) return false;
  return source.join("|") !== form.weighbridgeTicketUrls.join("|");
});
const policyLabel = computed(() => {
  if (!context.value?.geofenceEnabled) return "围栏校验已停用";
  return context.value.allowOutsideCheckIn ? "可围栏外打卡" : "仅围栏内打卡";
});
const autoLabel = computed(() => {
  if (!context.value?.geofenceEnabled) return "仅记录定位";
  return context.value.autoCheckIn ? "围栏内自动打卡" : "手动打卡";
});
const policyHint = computed(() => {
  if (!context.value?.geofenceEnabled) {
    return "电子围栏校验已关闭，定位仅用于运输留痕，不再按装卸货地点距离拦截打卡。";
  }

  return `围栏内${
    context.value.autoCheckIn
      ? "会自动生成打卡记录"
      : "需要点击下方按钮手动打卡"
  }；围栏外${context.value.allowOutsideCheckIn ? "可说明原因后手动打卡" : "不支持打卡"}。`;
});
const checkinModeLabel = computed(() => {
  const labels = { manual: "司机手动", automatic: "围栏自动", admin: "PC 端" };
  const mode = context.value?.operation?.checkinMode;
  return mode ? labels[mode] : "--";
});

onLoad((query) => {
  id.value = String(query?.id || "");
  operationType.value = query?.type === "unloading" ? "unloading" : "loading";
  checkinOnly.value = query?.mode === "arrival";
  void load();
});

async function load() {
  state.error = "";
  if (!id.value) {
    state.error = "缺少运单参数，请返回运单详情后重新进入";
    return;
  }
  state.loading = true;
  try {
    current.value = await waybillStore.loadDetail(id.value);
    context.value = await getCargoOperationContext(
      auth.token,
      id.value,
      operationType.value,
    );
    const operation = context.value.operation;
    Object.assign(form, {
      grossWeightTon: operation?.grossWeightTon ? String(operation.grossWeightTon) : "",
      tareWeightTon: operation?.tareWeightTon ? String(operation.tareWeightTon) : "",
      weightTon: operation?.weightTon ? String(operation.weightTon) : "",
      photoUrls: operation?.photoUrls || [],
      weighbridgeTicketUrls: operation?.weighbridgeTicketUrls || [],
      recognitionInfo: operation?.recognitionInfo || "",
      recognitionPayload: operation?.recognitionPayload || null,
      remark: operation?.remark || "",
    });
    if (!operation && context.value.autoCheckIn) await tryAutomaticCheckIn();
  } catch (error) {
    state.error = getUserFacingErrorMessage(error, `${title.value}信息加载失败`);
    showError(error, `${title.value}信息加载失败`);
  } finally {
    state.loading = false;
  }
}

function distanceMeters(location: CargoOperationLocation) {
  const target = context.value;
  if (!target) return null;
  return calculateDistanceMeters(
    location,
    target.centerLongitude,
    target.centerLatitude,
  );
}

function requestOutsideReason(distance: number): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.showModal({
      title: "围栏外打卡确认",
      content: `当前距${title.value}地约 ${Math.round(distance)} 米。继续打卡需填写原因，请在下一步输入。`,
      editable: true,
      placeholderText: "例如：园区入口封闭，在指定临时作业区",
      confirmText: "确认打卡",
      success(result) {
        if (!result.confirm) {
          reject(new Error("已取消打卡"));
          return;
        }
        const reason = String(result.content || "").trim();
        if (reason.length < 4) {
          reject(new Error("围栏外打卡原因至少填写 4 个字"));
          return;
        }
        resolve(reason);
      },
      fail() {
        reject(new Error("已取消打卡"));
      },
    });
  });
}

async function resolveOutsideReason(location: CargoOperationLocation) {
  const target = context.value;
  if (!target?.geofenceEnabled) return null;
  const distance = distanceMeters(location);
  if (distance === null || distance <= target.radiusM) return null;
  if (!target.allowOutsideCheckIn) {
    throw new Error(`当前不在${title.value}地围栏内，请到达现场后重新打卡`);
  }
  return await requestOutsideReason(distance);
}

async function tryAutomaticCheckIn() {
  try {
    const location = await getCurrentGcj02Location(address.value);
    const distance = distanceMeters(location);
    if (distance === null || !context.value || distance > context.value.radiusM)
      return;
    context.value = await checkInCargoOperation(
      auth.token,
      id.value,
      operationType.value,
      location,
      null,
      true,
    );
    uni.showToast({ title: `已自动${title.value}打卡`, icon: "success" });
  } catch {
    // 自动打卡失败不阻断页面，司机仍可查看策略并手动重试。
  }
}

async function handleCheckIn() {
  if (state.locating || context.value?.operation) return;
  state.locating = true;
  try {
    const location = await getCurrentGcj02Location(address.value);
    const outsideReason = await resolveOutsideReason(location);
    context.value = await checkInCargoOperation(
      auth.token,
      id.value,
      operationType.value,
      location,
      outsideReason,
    );
    uni.showToast({ title: `${title.value}打卡成功`, icon: "success" });
    if (checkinOnly.value) setTimeout(() => uni.navigateBack(), 450);
  } catch (error) {
    showError(error, "打卡失败");
  } finally {
    state.locating = false;
  }
}

async function uploadEvidence(kind: "photo" | "ticket") {
  if (!current.value || state.uploading) return;
  try {
    const currentCount =
      kind === "photo"
        ? form.photoUrls.length
        : form.weighbridgeTicketUrls.length;
    const paths = await chooseImages((kind === "photo" ? 5 : 3) - currentCount);
    if (!paths.length) return;
    state.uploading = kind;
    const operatorName =
      profile.driver?.driverName ||
      profile.user?.nickName ||
      profile.user?.userName;
    const files = await uploadWaybillProofFiles(
      auth.token,
      current.value,
      `${operationType.value}_${kind}`,
      paths,
      operatorName,
    );
    const urls = files.map((file) => file.url);
    if (kind === "photo")
      form.photoUrls = [...form.photoUrls, ...urls].slice(0, 5);
    else
      form.weighbridgeTicketUrls = [
        ...form.weighbridgeTicketUrls,
        ...urls,
      ].slice(0, 3);
  } catch (error) {
    showError(error, "上传失败");
  } finally {
    state.uploading = "";
  }
}

function preview(url: string, urls: string[]) {
  uni.previewImage({ current: url, urls });
}

function removeEvidence(kind: "photo" | "ticket", index: number) {
  if (isCompleted.value) return;
  const target = kind === "photo" ? form.photoUrls : form.weighbridgeTicketUrls;
  target.splice(index, 1);
}

async function analyzeWeighbridgeTicket() {
  if (state.analyzing || state.uploading || !form.weighbridgeTicketUrls.length) return;
  state.analyzing = true;
  try {
    const result = await analyzeCargoWeighbridgeTicket(
      auth.token,
      id.value,
      operationType.value,
      form.weighbridgeTicketUrls,
    );
    form.recognitionInfo = result.rawText;
    form.recognitionPayload = {
      ...result,
      source: "ai_ocr",
      ticketUrls: [...form.weighbridgeTicketUrls],
    };
    if (!form.grossWeightTon && result.weights.grossWeightTon) {
      form.grossWeightTon = String(result.weights.grossWeightTon);
    }
    if (!form.tareWeightTon && result.weights.tareWeightTon) {
      form.tareWeightTon = String(result.weights.tareWeightTon);
    }
    if (!form.weightTon && result.weights.netWeightTon) {
      form.weightTon = String(result.weights.netWeightTon);
    }
    uni.showToast({ title: "识别完成，请核对重量", icon: "success" });
  } catch (error) {
    showError(error, "磅单识别失败，请手工填写重量");
  } finally {
    state.analyzing = false;
  }
}

async function submit() {
  if (!context.value?.operation) {
    uni.showToast({ title: `请先完成${title.value}打卡`, icon: "none" });
    return;
  }
  const weightTon = Number(form.weightTon);
  if (!Number.isFinite(weightTon) || weightTon <= 0) {
    uni.showToast({ title: `请输入正确的${title.value}重量`, icon: "none" });
    return;
  }
  const grossWeightTon = form.grossWeightTon ? Number(form.grossWeightTon) : null;
  const tareWeightTon = form.tareWeightTon ? Number(form.tareWeightTon) : null;
  if (grossWeightTon !== null && (!Number.isFinite(grossWeightTon) || grossWeightTon <= 0)) {
    uni.showToast({ title: "请输入正确的毛重", icon: "none" });
    return;
  }
  if (tareWeightTon !== null && (!Number.isFinite(tareWeightTon) || tareWeightTon <= 0)) {
    uni.showToast({ title: "请输入正确的皮重", icon: "none" });
    return;
  }
  if (grossWeightTon !== null && tareWeightTon !== null && grossWeightTon < tareWeightTon) {
    uni.showToast({ title: "毛重不能小于皮重", icon: "none" });
    return;
  }
  if (!form.photoUrls.length) {
    uni.showToast({ title: `请上传${title.value}照片`, icon: "none" });
    return;
  }
  if (!form.weighbridgeTicketUrls.length) {
    uni.showToast({ title: `请上传${title.value}磅单`, icon: "none" });
    return;
  }
  state.submitting = true;
  try {
    context.value = await completeCargoOperation(
      auth.token,
      id.value,
      operationType.value,
      {
        grossWeightTon,
        tareWeightTon,
        weightTon,
        photoUrls: [...form.photoUrls],
        weighbridgeTicketUrls: [...form.weighbridgeTicketUrls],
        recognitionInfo: form.recognitionInfo || null,
        recognitionPayload: form.recognitionPayload,
        remark: form.remark.trim() || null,
      },
    );
    await waybillStore.loadDetail(id.value);
    uni.showToast({ title: `${title.value}信息已提交`, icon: "success" });
    setTimeout(() => uni.navigateBack(), 650);
  } catch (error) {
    showError(error, "提交失败");
  } finally {
    state.submitting = false;
  }
}

function showError(error: unknown, fallback: string) {
  const message = getUserFacingErrorMessage(error, fallback);
  if (message === "已取消打卡") return;
  uni.showToast({ title: message || fallback, icon: "none", duration: 3000 });
}
</script>

<template>
  <view
    class="operation-page page"
    :class="{
      'operation-page--with-footer':
        context?.operation && !isCompleted && !checkinOnly,
    }"
  >
    <view class="operation-page__hero">
      <TmsTopBar :title="pageTitle" show-back />
      <view class="operation-page__hero-main">
        <view class="operation-page__hero-icon">
          <TmsIcon
            :name="operationType === 'loading' ? 'vehicle' : 'document'"
            size="44rpx"
          />
        </view>
        <view>
          <text class="operation-page__eyebrow">CARGO OPERATION</text>
          <text class="operation-page__title">{{
            current?.waybillNo || "运单装卸货"
          }}</text>
          <text class="operation-page__address">{{ address }}</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="operation-page__scroll">
      <TmsPageSkeleton
        v-if="state.loading || state.error"
        :label="`正在加载${title}规则与现场资料…`"
        :error="state.error"
        @retry="load"
      />

      <view v-else-if="context" class="operation-page__content">
        <view class="policy-card card">
          <view class="policy-card__header">
            <view>
              <text class="section-kicker">电子围栏策略</text>
              <text class="section-title">{{ policyLabel }}</text>
            </view>
            <view class="policy-card__badge">{{ autoLabel }}</view>
          </view>
          <view class="policy-card__grid">
            <view
              ><text>围栏半径</text
              ><strong>{{ context.radiusM }} 米</strong></view
            >
            <view
              ><text>资料要求</text><strong>净重 + 照片 + 磅单</strong></view
            >
          </view>
          <text class="policy-card__hint">{{ policyHint }}</text>
        </view>

        <view
          class="checkin-card card"
          :class="{ 'is-done': context.operation }"
        >
          <view class="checkin-card__status">
            <view class="checkin-card__icon">
              <TmsIcon
                :name="context.operation ? 'check' : 'location'"
                size="36rpx"
              />
            </view>
            <view>
              <text class="section-title">{{
                context.operation ? "已完成定位打卡" : "等待定位打卡"
              }}</text>
              <text class="checkin-card__sub">
                {{
                  context.operation
                    ? `${formatDateTime(context.operation.checkinTime)} · ${checkinModeLabel}`
                    : "打卡时间和位置以服务端记录为准"
                }}
              </text>
            </view>
          </view>
          <view v-if="context.operation" class="checkin-card__metrics">
            <view>
              <text>{{
                context.geofenceEnabled ? "围栏判定" : "围栏校验"
              }}</text>
              <strong>{{
                !context.geofenceEnabled
                  ? "已停用"
                  : context.operation.insideGeofence
                    ? "围栏内"
                    : "围栏外"
              }}</strong>
            </view>
            <view>
              <text>距中心</text>
              <strong>{{ Math.round(context.operation.distanceM) }} 米</strong>
            </view>
            <view>
              <text>定位精度</text>
              <strong>{{
                context.operation.locationAccuracyM
                  ? `约 ${Math.round(context.operation.locationAccuracyM)} 米`
                  : "--"
              }}</strong>
            </view>
          </view>
          <wd-button
            v-else
            class="checkin-card__button"
            custom-class="tms-primary-action"
            type="primary"
            :round="false"
            :loading="state.locating"
            loading-color="#ffffff"
            :disabled="state.locating"
            @click="handleCheckIn"
          >
            <wd-icon v-if="!state.locating" name="location" size="32rpx" />
            获取定位并打卡
          </wd-button>
        </view>

        <view v-if="!checkinOnly" class="form-card card">
          <view class="form-card__header">
            <view>
              <text class="section-kicker">现场资料</text>
              <text class="section-title">补齐{{ title }}信息</text>
            </view>
            <text v-if="isCompleted" class="form-card__completed">已完成</text>
          </view>

          <view v-if="!context.operation" class="form-card__locked">
            <view class="form-card__locked-icon"
              ><TmsIcon name="location" size="30rpx"
            /></view>
            <view>
              <strong>完成定位后填写资料</strong>
              <text>定位打卡成功后，重量与凭证上传会自动启用</text>
            </view>
          </view>

          <view class="field-block">
            <text class="field-block__label"
              >{{ title }}净重（吨）<text class="required-mark">*</text></text
            >
            <view class="weight-input">
              <input
                v-model="form.weightTon"
                type="digit"
                :disabled="!context.operation || isCompleted"
                :placeholder="`请输入${title}净重`"
              />
              <text>吨</text>
            </view>
            <text class="field-block__help"
              >必填，以最终确认的实际净重为准，最多保留 3 位小数</text
            >
          </view>

          <view class="weight-grid">
            <view class="field-block weight-grid__item">
              <text class="field-block__label">毛重（吨）</text>
              <view class="weight-input">
                <input
                  v-model="form.grossWeightTon"
                  type="digit"
                  :disabled="!context.operation || isCompleted"
                  placeholder="选填"
                />
                <text>吨</text>
              </view>
            </view>
            <view class="field-block weight-grid__item">
              <text class="field-block__label">皮重（吨）</text>
              <view class="weight-input">
                <input
                  v-model="form.tareWeightTon"
                  type="digit"
                  :disabled="!context.operation || isCompleted"
                  placeholder="选填"
                />
                <text>吨</text>
              </view>
            </view>
          </view>
          <view v-if="calculatedNetWeight !== null" class="weight-check">
            <text>毛重－皮重</text>
            <strong>{{ calculatedNetWeight }} 吨</strong>
          </view>
          <text v-if="weightDifferenceWarning" class="weight-warning">
            {{ weightDifferenceWarning }}
          </text>

          <view class="field-block">
            <text class="field-block__label"
              >{{ title }}照片<text class="required-mark">*</text></text
            >
            <text class="field-block__help"
              >建议拍摄车辆、货物与现场环境，确保车牌无遮挡</text
            >
            <view class="evidence-grid">
              <view
                v-for="(url, index) in form.photoUrls"
                :key="url"
                class="evidence-grid__item"
              >
                <image
                  :src="url"
                  mode="aspectFill"
                  @click="preview(url, form.photoUrls)"
                />
                <button
                  v-if="!isCompleted"
                  class="evidence-grid__remove"
                  @click="removeEvidence('photo', index)"
                >
                  ×
                </button>
              </view>
              <button
                v-if="!isCompleted && form.photoUrls.length < 5"
                class="evidence-grid__add"
                :disabled="!context.operation || !!state.uploading"
                @click="uploadEvidence('photo')"
              >
                <wd-loading
                  v-if="state.uploading === 'photo'"
                  type="ring"
                  color="#3763f4"
                  size="30rpx"
                />
                <view v-else class="evidence-grid__add-content">
                  <wd-icon name="camera" size="42rpx" />
                  <text>上传照片</text>
                </view>
              </button>
            </view>
            <text class="field-block__quota"
              >已上传 {{ form.photoUrls.length }}/5 张</text
            >
          </view>

          <view class="field-block">
            <text class="field-block__label"
              >{{ title }}磅单<text class="required-mark">*</text></text
            >
            <text class="field-block__help"
              >请拍摄完整磅单，重量、日期和单号应清晰可见</text
            >
            <view class="evidence-grid">
              <view
                v-for="(url, index) in form.weighbridgeTicketUrls"
                :key="url"
                class="evidence-grid__item"
              >
                <image
                  :src="url"
                  mode="aspectFill"
                  @click="preview(url, form.weighbridgeTicketUrls)"
                />
                <button
                  v-if="!isCompleted"
                  class="evidence-grid__remove"
                  @click="removeEvidence('ticket', index)"
                >
                  ×
                </button>
              </view>
              <button
                v-if="!isCompleted && form.weighbridgeTicketUrls.length < 3"
                class="evidence-grid__add"
                :disabled="!context.operation || !!state.uploading"
                @click="uploadEvidence('ticket')"
              >
                <wd-loading
                  v-if="state.uploading === 'ticket'"
                  type="ring"
                  color="#3763f4"
                  size="30rpx"
                />
                <view v-else class="evidence-grid__add-content">
                  <wd-icon name="camera" size="42rpx" />
                  <text>上传磅单</text>
                </view>
              </button>
            </view>
            <text class="field-block__quota"
              >已上传 {{ form.weighbridgeTicketUrls.length }}/3 张</text
            >
          </view>

          <view class="recognition-card" :class="{ 'is-stale': recognitionIsStale }">
            <view class="recognition-card__head">
              <view class="recognition-card__identity">
                <view class="recognition-card__icon">
                  <TmsIcon name="document" size="28rpx" />
                </view>
                <view>
                  <strong>识别信息</strong>
                  <text>保留 OCR 原始文本，识别错误也不会写入备注</text>
                </view>
              </view>
              <button
                v-if="!isCompleted"
                class="recognition-card__action"
                :disabled="
                  !context.operation ||
                  !form.weighbridgeTicketUrls.length ||
                  state.analyzing ||
                  !!state.uploading
                "
                @click="analyzeWeighbridgeTicket"
              >
                <wd-loading
                  v-if="state.analyzing"
                  type="ring"
                  color="#4f46e5"
                  size="24rpx"
                />
                <wd-icon v-else name="camera" size="24rpx" />
                <text>{{ form.recognitionInfo ? "重新识别" : "识别磅单" }}</text>
              </button>
            </view>
            <view v-if="form.recognitionInfo" class="recognition-card__result">
              <view class="recognition-card__result-meta">
                <text>
                  {{
                    recognitionConfidence === null
                      ? "OCR 原文"
                      : `OCR 原文 · 可信度 ${recognitionConfidence}%`
                  }}
                </text>
                <text v-if="recognitionIsStale" class="recognition-card__stale">
                  磅单已变更，请重新识别
                </text>
              </view>
              <text class="recognition-card__raw">{{ form.recognitionInfo }}</text>
              <text v-if="recognitionWarnings.length" class="recognition-card__warning">
                {{ recognitionWarnings.slice(0, 3).join("；") }}
              </text>
              <text class="recognition-card__notice">
                识别内容仅供备查；毛重、皮重和净重以司机最终确认值为准。
              </text>
            </view>
            <text v-else class="recognition-card__empty">
              上传磅单后可进行识别。未识别或识别失败不影响手工填写和提交。
            </text>
          </view>

          <view class="field-block">
            <text class="field-block__label">备注</text>
            <textarea
              v-model="form.remark"
              :disabled="!context.operation || isCompleted"
              maxlength="300"
              placeholder="可填写货损、磅差或现场说明"
            />
            <text class="field-block__count">{{ form.remark.length }}/300</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view
      v-if="context?.operation && !isCompleted && !checkinOnly"
      class="operation-footer safe-bottom"
    >
      <view>
        <text>{{
          submitMissing.length
            ? `还需补充：${submitMissing.join("、")}`
            : "资料已完整，可以提交"
        }}</text>
        <strong>{{
          submitMissing.length ? "请完成必填项" : `确认${title}完成`
        }}</strong>
      </view>
      <wd-button
        class="operation-footer__button"
        custom-class="tms-primary-action"
        type="primary"
        :round="false"
        :loading="state.submitting"
        loading-color="#ffffff"
        :disabled="!canSubmit"
        @click="submit"
      >
        提交{{ title }}信息
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.operation-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.operation-page__hero {
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(145deg, #315bef, #4978ff);
}

.operation-page__hero-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 30rpx 34rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.14);
}

.operation-page__hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 82rpx;
  height: 82rpx;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 22rpx;
}

.operation-page__eyebrow,
.operation-page__title,
.operation-page__address {
  display: block;
}

.operation-page__eyebrow {
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
  opacity: 0.78;
}

.operation-page__title {
  margin-top: 4rpx;
  font-size: 34rpx;
  font-weight: 800;
}

.operation-page__address {
  max-width: 550rpx;
  margin-top: 6rpx;
  overflow: hidden;
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.88;
}

.operation-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}

.operation-page--with-footer .operation-page__scroll {
  height: auto;
}

.operation-page__content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx 26rpx 50rpx;
}

.policy-card,
.checkin-card,
.form-card {
  padding: 28rpx;
}

.policy-card__header,
.form-card__header,
.checkin-card__status {
  display: flex;
  gap: 18rpx;
  align-items: center;
  justify-content: space-between;
}

.section-kicker,
.section-title {
  display: block;
}

.section-kicker {
  color: var(--tms-primary);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.section-title {
  margin-top: 5rpx;
  color: var(--tms-text);
  font-size: 30rpx;
  font-weight: 800;
}

.policy-card__badge,
.form-card__completed {
  padding: 9rpx 18rpx;
  color: var(--tms-primary);
  background: var(--tms-blue-soft);
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.form-card__completed {
  color: var(--tms-green);
  background: #eaf9f2;
}

.policy-card__grid,
.checkin-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 24rpx;
}

.policy-card__grid > view,
.checkin-card__metrics > view {
  padding: 18rpx;
  background: var(--tms-panel);
  border-radius: 12rpx;
}

.policy-card__grid text,
.policy-card__grid strong,
.checkin-card__metrics text,
.checkin-card__metrics strong {
  display: block;
}

.policy-card__grid text,
.checkin-card__metrics text {
  color: var(--tms-muted);
  font-size: 22rpx;
}

.policy-card__grid strong,
.checkin-card__metrics strong {
  margin-top: 8rpx;
  color: var(--tms-text);
  font-size: 25rpx;
}

.policy-card__hint {
  display: block;
  margin-top: 20rpx;
  color: var(--tms-muted);
  font-size: 23rpx;
  line-height: 1.65;
}

.checkin-card {
  border: 2rpx solid transparent;
}

.checkin-card.is-done {
  border-color: rgba(37, 191, 117, 0.28);
}

.checkin-card__status {
  justify-content: flex-start;
}

.checkin-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66rpx;
  height: 66rpx;
  color: var(--tms-primary);
  background: var(--tms-blue-soft);
  border-radius: 50%;
}

.checkin-card.is-done .checkin-card__icon {
  color: var(--tms-green);
  background: #eaf9f2;
}

.checkin-card__sub {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: 22rpx;
}

.checkin-card__metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.checkin-card__button {
  width: 100%;
  margin-top: 26rpx;
}

.form-card__locked {
  margin-top: 24rpx;
  padding: 20rpx;
  border: 1rpx solid #dbe4ff;
  border-radius: 18rpx;
  color: #3449a4;
  background: linear-gradient(135deg, #f3f6ff, #eef3ff);
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.form-card__locked-icon {
  flex: 0 0 auto;
  width: 54rpx;
  height: 54rpx;
  border-radius: 16rpx;
  color: #4f46e5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-card__locked strong,
.form-card__locked text {
  display: block;
}

.form-card__locked strong {
  font-size: 24rpx;
}

.form-card__locked text {
  margin-top: 5rpx;
  color: #6f7c91;
  font-size: 21rpx;
}

.field-block {
  position: relative;
  margin-top: 30rpx;
}

.field-block__label {
  color: var(--tms-text);
  font-size: 26rpx;
  font-weight: 800;
}

.field-block__help {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: 21rpx;
  line-height: 1.5;
}

.field-block__quota {
  display: block;
  margin-top: 10rpx;
  color: #8b95a8;
  font-size: 20rpx;
  text-align: right;
}

.weight-input {
  display: flex;
  align-items: center;
  height: 82rpx;
  margin-top: 14rpx;
  padding: 0 22rpx;
  background: var(--tms-panel);
  border: 2rpx solid var(--tms-line);
  border-radius: 16rpx;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.weight-input input {
  flex: 1;
  height: 100%;
  color: var(--tms-text);
  font-size: 28rpx;
}

.weight-input text {
  color: var(--tms-muted);
  font-weight: 700;
}

.weight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.weight-grid__item {
  min-width: 0;
}

.weight-grid .weight-input {
  padding: 0 16rpx;
}

.weight-grid .weight-input input {
  min-width: 0;
}

.weight-check {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  color: #52627a;
  background: #f3f6fb;
  border-radius: 14rpx;
  font-size: 22rpx;
}

.weight-check strong {
  color: var(--tms-text);
  font-size: 24rpx;
}

.weight-warning {
  display: block;
  margin-top: 12rpx;
  padding: 14rpx 18rpx;
  color: #9a5d00;
  background: #fff7e8;
  border-left: 5rpx solid #f59e0b;
  border-radius: 12rpx;
  font-size: 21rpx;
  line-height: 1.55;
}

.recognition-card {
  margin-top: 30rpx;
  padding: 22rpx;
  background: linear-gradient(145deg, #f4f7ff, #eef3ff);
  border: 1rpx solid #d9e2ff;
  border-radius: 18rpx;
}

.recognition-card.is-stale {
  background: #fff9ef;
  border-color: #f1d79e;
}

.recognition-card__head,
.recognition-card__identity,
.recognition-card__action,
.recognition-card__result-meta {
  display: flex;
  align-items: center;
}

.recognition-card__head,
.recognition-card__result-meta {
  justify-content: space-between;
  gap: 16rpx;
}

.recognition-card__identity {
  min-width: 0;
  gap: 14rpx;
}

.recognition-card__identity > view:last-child {
  min-width: 0;
}

.recognition-card__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  color: var(--tms-primary);
  background: #fff;
  border-radius: 14rpx;
}

.recognition-card__identity strong,
.recognition-card__identity text {
  display: block;
}

.recognition-card__identity strong {
  color: var(--tms-text);
  font-size: 24rpx;
}

.recognition-card__identity text {
  margin-top: 4rpx;
  color: var(--tms-muted);
  font-size: 20rpx;
  line-height: 1.45;
}

.recognition-card__action {
  flex: 0 0 auto;
  justify-content: center;
  gap: 7rpx;
  min-width: 142rpx;
  min-height: 64rpx;
  margin: 0;
  padding: 0 16rpx;
  color: var(--tms-primary);
  background: #fff;
  border: 1rpx solid #cfd9ff;
  border-radius: 14rpx;
  font-size: 21rpx;
}

.recognition-card__action::after {
  border: 0;
}

.recognition-card__action[disabled] {
  color: #99a3b5;
  background: #f2f4f8;
  border-color: #e0e4ec;
  opacity: 1;
}

.recognition-card__result {
  margin-top: 18rpx;
}

.recognition-card__result-meta {
  color: #536586;
  font-size: 20rpx;
}

.recognition-card__stale {
  color: #9a5d00;
  font-weight: 700;
}

.recognition-card__raw {
  display: block;
  max-height: 320rpx;
  margin-top: 10rpx;
  padding: 18rpx;
  overflow: auto;
  color: #28364c;
  background: rgba(255, 255, 255, 0.88);
  border: 1rpx solid #dce3f3;
  border-radius: 14rpx;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 21rpx;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.recognition-card__warning,
.recognition-card__notice,
.recognition-card__empty {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  line-height: 1.55;
}

.recognition-card__warning {
  color: #a15f00;
}

.recognition-card__notice,
.recognition-card__empty {
  color: var(--tms-muted);
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 16rpx;
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
  background: var(--tms-panel);
  border: 2rpx dashed #cfd6e5;
  border-radius: 18rpx;
}

.evidence-grid__item image {
  width: 100%;
  height: 100%;
}

.evidence-grid__add {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tms-primary);
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

.evidence-grid__remove {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 42rpx;
  height: 42rpx;
  padding: 0;
  color: #fff;
  background: rgba(20, 28, 43, 0.72);
  border-radius: 50%;
  font-size: 30rpx;
  line-height: 40rpx;
}

.field-block textarea {
  width: 100%;
  min-height: 150rpx;
  margin-top: 14rpx;
  padding: 20rpx 20rpx 50rpx;
  color: var(--tms-text);
  background: var(--tms-panel);
  border: 2rpx solid var(--tms-line);
  border-radius: 16rpx;
  font-size: 25rpx;
}

.field-block__count {
  position: absolute;
  right: 18rpx;
  bottom: 14rpx;
  color: var(--tms-light);
  font-size: 20rpx;
}

.operation-footer {
  flex: 0 0 auto;
  display: flex;
  gap: 22rpx;
  align-items: center;
  justify-content: space-between;
  min-height: 136rpx;
  padding: 18rpx 26rpx;
  background: #fff;
  border-top: 1rpx solid var(--tms-line);
  box-shadow: 0 -10rpx 28rpx rgba(30, 41, 66, 0.07);
}

.operation-footer text,
.operation-footer strong {
  display: block;
}

.operation-footer text {
  color: var(--tms-muted);
  font-size: 21rpx;
}

.operation-footer strong {
  margin-top: 4rpx;
  color: var(--tms-text);
  font-size: 26rpx;
}

.operation-footer__button {
  width: 310rpx;
}
</style>
