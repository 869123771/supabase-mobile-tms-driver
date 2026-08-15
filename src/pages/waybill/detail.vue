<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getUserFacingErrorMessage } from "@/api/supabase";
import { getDriverExpenseContext } from "@/api/expense";
import {
  checkInCargoOperation,
  getCargoOperationContext,
  getWaybillExecutionContext,
} from "@/api/waybill";
import type {
  CargoOperationType,
  DriverExpenseRecord,
  WaybillExecutionContext,
} from "@/api/types";
import TmsIcon from "@/components/business/TmsIcon.vue";
import TmsRouteCard from "@/components/business/TmsRouteCard.vue";
import TmsTopBar from "@/components/business/TmsTopBar.vue";
import WaybillTrackingTimeline from "@/components/business/WaybillTrackingTimeline.vue";
import WaybillTrajectoryPanel from "@/components/business/WaybillTrajectoryPanel.vue";
import WaybillSignatureSheet from "@/components/business/WaybillSignatureSheet.vue";
import { useDictionaryStore } from "@/stores/dictionary";
import { useAuthStore } from "@/stores/auth";
import { useWaybillStore } from "@/stores/waybill";
import {
  formatDateTime,
  formatMoney,
  formatTon,
  maskPhone,
} from "@/utils/format";
import { openWaybillNavigation } from "@/utils/navigation";
import {
  calculateDistanceMeters,
  getCurrentGcj02Location,
} from "@/utils/location";

const waybill = useWaybillStore();
const auth = useAuthStore();
const dictionary = useDictionaryStore();
const id = ref("");
type DetailAction = "accept" | "cancel";
type DetailTab = "tracking" | "trajectory";
const activeAction = ref<DetailAction | "">("");
const activeDetailTab = ref<DetailTab>("tracking");
const executionContext = ref<WaybillExecutionContext>();
const signatureVisible = ref(false);
const expenseRecords = ref<DriverExpenseRecord[]>([]);
const trackingWarning = ref("");

const current = computed(() => waybill.current);
const isPending = computed(() => current.value?.status === "pending");
const isCompleted = computed(() => current.value?.status === "completed");
const isAccepted = computed(() => current.value?.status === "accepted");
const isLoading = computed(() => current.value?.status === "loading");
const isTransporting = computed(() => current.value?.status === "transporting");
const isUnloading = computed(() => current.value?.status === "unloading");
const isSigned = computed(() => current.value?.status === "signed");
const canReportExpense = computed(() =>
  Boolean(
    current.value &&
      [
        "accepted",
        "loading",
        "transporting",
        "unloading",
        "signed",
        "completed",
      ].includes(current.value.status),
  ),
);
const needsReturnCompletion = computed(() =>
  Boolean(
    executionContext.value?.needsReturnCompletion &&
    executionContext.value?.canComplete,
  ),
);
const actionBusy = computed(
  () => Boolean(activeAction.value) || waybill.actionLoading,
);
const deliveryProofCount = computed(
  () =>
    waybill.proofs.filter(
      (proof) =>
        proof.proofType === "delivery_photo" || proof.proofType === "receipt",
    ).length,
);

const statusTitle = computed(() => {
  const status = current.value?.status;
  if (status === "accepted") return "待提货";
  if (status === "loading") return "待发车";
  if (status === "transporting") return "运输中";
  if (status === "unloading") return "待卸货";
  if (status === "signed") return "已签收";
  if (status === "completed") return "已完成";
  if (status === "cancelled") return "已取消";
  return dictionary.label("tmsWaybillStatus", status, "待处理");
});

const statusHint = computed(() => {
  const item = current.value;
  if (!item) return "";
  if (item.status === "accepted") {
    return "到达装货地后请完成定位打卡和装货资料";
  }
  if (item.status === "loading") return "提货凭证已上传，请确认发车";
  if (item.status === "transporting") return "到达目的地后请确认到达";
  if (item.status === "unloading")
    return executionContext.value?.unloadingStatus === "completed"
      ? "卸货资料已完成，请办理签收"
      : "已到达目的地，请填写卸货信息";
  if (item.status === "signed") return "签收已完成，请录入收车时间和收车里程";
  if (item.status === "completed") {
    return needsReturnCompletion.value
      ? "历史完成状态缺少回场档案，请补录收车时间、里程和照片"
      : `已于${formatDateTime(item.completedAt || item.unloadedAt)}送达!`;
  }
  if (item.status === "cancelled") return "该运单已取消";
  return "请核对订单信息后接受任务";
});

const proofUrls = computed(() =>
  waybill.proofs.map((item) => item.fileUrl).filter(Boolean),
);
const cargoTypeLabel = computed(() => {
  const item = current.value;
  if (!item) return "--";
  return dictionary.labelAny(
    ["tmsCustomerPriceCargoType", "tmsCargoUnit"],
    item.cargoType,
    item.cargoName || "--",
  );
});
const cargoRows = computed(() => {
  const item = current.value;
  if (!item) return [];
  return [
    { label: "货物类型", value: cargoTypeLabel.value },
    { label: "货物重量", value: formatTon(item.cargoWeightTon) },
    {
      label: "货物体积",
      value: item.cargoVolumeM3 ? `${item.cargoVolumeM3}m³` : "--",
    },
    { label: "数量", value: item.cargoQuantity || "--" },
  ];
});
const stationRows = computed(() => {
  const item = current.value;
  if (!item) return [];
  return [
    {
      label: "发货站",
      station: item.fromStationName || item.originCity || "--",
      name: item.senderName || item.shipperName || "--",
      phone: item.senderPhone || item.shipperPhone || "",
      address: item.senderAddress || item.shipperAddress || "--",
    },
    {
      label: "到货站",
      station: item.toStationName || item.destinationCity || "--",
      name: item.receiverName || "--",
      phone: item.receiverPhone || "",
      address: item.receiverAddress || "--",
    },
  ];
});

onLoad((query) => {
  id.value = String(query?.id || "");
});

onShow(() => void load());

async function load() {
  if (!id.value) return;
  try {
    trackingWarning.value = "";
    const loaded = await waybill.loadDetail(id.value);
    const [executionResult, expenseResult] = await Promise.allSettled([
      getWaybillExecutionContext(auth.token, id.value),
      getDriverExpenseContext(auth.token, id.value),
    ]);
    if (executionResult.status === "fulfilled") {
      executionContext.value = executionResult.value;
    } else {
      executionContext.value = undefined;
      uni.showToast({
        title: getUserFacingErrorMessage(
          executionResult.reason,
          "任务节点同步失败，请稍后重试",
        ),
        icon: "none",
        duration: 3000,
      });
    }
    if (expenseResult.status === "fulfilled") {
      expenseRecords.value = expenseResult.value.records;
    } else {
      expenseRecords.value = [];
      trackingWarning.value = "费用上报记录暂未同步，其他运输节点仍可正常查看，请稍后刷新。";
      console.warn(
        "failed to load expense records for waybill tracking",
        expenseResult.reason,
      );
    }
    await tryAutomaticCargoCheckIn(loaded);
  } catch (error) {
    uni.showToast({
      title: getUserFacingErrorMessage(error, "任务详情加载失败，请稍后重试"),
      icon: "none",
    });
  }
}

async function tryAutomaticCargoCheckIn(item: typeof current.value) {
  if (!item) return;
  const operationType: CargoOperationType | null =
    item.status === "accepted"
      ? "loading"
      : item.status === "transporting"
        ? "unloading"
        : null;
  if (!operationType) return;

  try {
    const context = await getCargoOperationContext(
      auth.token,
      item.id,
      operationType,
    );
    if (!context.geofenceEnabled || !context.autoCheckIn || context.operation)
      return;
    const operationAddress =
      operationType === "loading" ? item.shipperAddress : item.receiverAddress;
    const location = await getCurrentGcj02Location(operationAddress);
    const distance = calculateDistanceMeters(
      location,
      context.centerLongitude,
      context.centerLatitude,
    );
    if (distance === null || distance > context.radiusM) return;
    await checkInCargoOperation(
      auth.token,
      item.id,
      operationType,
      location,
      null,
      true,
    );
    await waybill.loadDetail(item.id);
    executionContext.value = await getWaybillExecutionContext(
      auth.token,
      item.id,
    );
    uni.showToast({
      title: `已自动${operationType === "loading" ? "装货" : "卸货"}打卡`,
      icon: "success",
    });
  } catch {
    // 自动定位不阻断详情页，司机仍可进入作业页手动重试。
  }
}

function navigate() {
  openWaybillNavigation(current.value);
}

function callPhone(phone?: string) {
  if (!phone) {
    uni.showToast({ title: "暂无联系电话", icon: "none" });
    return;
  }
  uni.makePhoneCall({ phoneNumber: phone });
}

async function accept() {
  if (actionBusy.value) return;
  activeAction.value = "accept";
  try {
    await waybill.acceptCurrent();
    uni.showToast({ title: "已接受任务", icon: "success" });
  } catch (error) {
    showActionError(error, "接受任务失败，请稍后重试");
  } finally {
    activeAction.value = "";
  }
}

function openCargoOperation(type: "loading" | "unloading", mode?: "arrival") {
  if (!current.value) return;
  uni.navigateTo({
    url: `/pages/waybill/cargo-operation?id=${encodeURIComponent(current.value.id)}&type=${type}${mode ? `&mode=${mode}` : ""}`,
  });
}

function openExecutionOperation(action: "departure" | "completion") {
  if (!current.value) return;
  uni.navigateTo({
    url: `/pages/waybill/execution-operation?id=${encodeURIComponent(current.value.id)}&action=${action}`,
  });
}

function openExpense() {
  if (!current.value || !canReportExpense.value) return;
  uni.navigateTo({
    url: `/pages/waybill/expense?id=${encodeURIComponent(current.value.id)}&create=1`,
  });
}

function showActionError(error: unknown, fallback: string) {
  const message = getUserFacingErrorMessage(error, fallback);
  const title = /状态不允许|运输节点|已进入下一/.test(message)
    ? "运单状态已变化，请刷新后重试"
    : message;
  uni.showToast({ title, icon: "none", duration: 2600 });
}

function cancel() {
  uni.showModal({
    title: "取消运单",
    editable: true,
    placeholderText: "请填写取消原因（至少 4 个字）",
    confirmColor: "#f05252",
    success: async (result) => {
      if (!result.confirm) return;
      const reason = String(result.content || "").trim();
      if (reason.length < 4) {
        uni.showToast({ title: "取消原因至少填写 4 个字", icon: "none" });
        return;
      }
      activeAction.value = "cancel";
      try {
        await waybill.cancelCurrent(reason);
        uni.showToast({ title: "已取消", icon: "success" });
      } catch (error) {
        showActionError(error, "取消失败，请稍后重试");
      } finally {
        activeAction.value = "";
      }
    },
  });
}

async function handleSignatureSuccess() {
  signatureVisible.value = false;
  await load();
  if (!executionContext.value?.canComplete) return;
  uni.showModal({
    title: "签收已完成",
    content: "是否现在录入收车时间、里程和车辆照片，完成本次运输闭环？",
    confirmText: "去录入",
    cancelText: "稍后处理",
    success: (result) => {
      if (result.confirm) openExecutionOperation("completion");
    },
  });
}

function viewReceipt() {
  if (proofUrls.value.length === 0) {
    uni.showToast({ title: "暂无回单文件", icon: "none" });
    return;
  }
  uni.previewImage({ urls: proofUrls.value });
}
</script>

<template>
  <view
    class="detail-page page"
    :class="{
      'detail-page--pending': isPending,
    }"
  >
    <view class="detail-page__blue">
      <TmsTopBar
        title="任务详情"
        eyebrow="运单进度"
        subtitle="按当前运输节点完成操作"
        show-back
      />
      <view v-if="current" class="detail-page__status">
        <view class="detail-page__status-icon"
          ><TmsIcon name="document" size="38rpx"
        /></view>
        <view>
          <text class="detail-page__status-title">{{ statusTitle }}</text>
          <text class="detail-page__hint">{{ statusHint }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="detail-page__scroll"
      :class="{ 'detail-page__scroll--header-only': !current && !isPending }"
    >
      <view v-if="current" class="detail-page__content">
        <TmsRouteCard
          :waybill="current"
          :show-progress="!isPending"
          :clickable="false"
          @navigate="navigate"
        >
          <view v-if="!isPending" class="detail-actions">
            <view v-if="isAccepted" class="detail-actions__helper">
              <wd-icon name="info-circle" size="28rpx" />
              <text>到达装货地后先定位打卡，再补齐重量、现场照片和磅单</text>
            </view>
            <view
              v-else-if="isLoading"
              class="detail-actions__helper detail-actions__helper--success"
            >
              <wd-icon name="check-circle" size="28rpx" />
              <text>提货凭证已保存，请确认车辆已发车</text>
            </view>
            <view v-else-if="isUnloading" class="detail-actions__helper">
              <wd-icon name="info-circle" size="28rpx" />
              <text>{{
                executionContext?.unloadingStatus === "completed"
                  ? "卸货资料已完成，可以办理签收"
                  : "请补齐卸货净重、现场照片和磅单"
              }}</text>
            </view>
            <view
              v-else-if="isSigned || needsReturnCompletion"
              class="detail-actions__helper"
              :class="{
                'detail-actions__helper--success': isSigned && !isCompleted,
              }"
            >
              <wd-icon
                :name="isCompleted ? 'warning' : 'check-circle'"
                size="28rpx"
              />
              <text>{{
                isCompleted
                  ? "检测到历史完成状态缺少回场档案，请补录"
                  : `签收已确认，${deliveryProofCount} 张回单已归档`
              }}</text>
            </view>

            <view class="detail-actions__controls">
              <wd-button
                v-if="isAccepted"
                class="detail-actions__outline"
                custom-class="tms-danger-action"
                type="error"
                plain
                :round="false"
                :disabled="actionBusy"
                @click.stop="cancel"
              >
                <view class="detail-actions__button-content">
                  <wd-loading
                    v-if="activeAction === 'cancel'"
                    type="ring"
                    color="#dc2626"
                    size="28rpx"
                  />
                  <wd-icon v-else name="close" size="28rpx" />
                  <text>{{
                    activeAction === "cancel" ? "正在取消" : "取消运单"
                  }}</text>
                </view>
              </wd-button>
              <wd-button
                v-if="isAccepted"
                class="detail-actions__primary"
                custom-class="tms-primary-action"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="openCargoOperation('loading')"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="location" size="30rpx" />
                  <text>装货打卡</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isLoading"
                class="detail-actions__primary detail-actions__primary--wide"
                custom-class="tms-primary-action"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="openExecutionOperation('departure')"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="vehicle" size="30rpx" />
                  <text>录入发车信息</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isTransporting"
                class="detail-actions__primary detail-actions__primary--wide"
                custom-class="tms-primary-action"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="openCargoOperation('unloading', 'arrival')"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="location" size="30rpx" />
                  <text>到达打卡</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isUnloading"
                class="detail-actions__primary detail-actions__primary--wide"
                custom-class="tms-primary-action"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="
                  executionContext?.unloadingStatus === 'completed'
                    ? (signatureVisible = true)
                    : openCargoOperation('unloading')
                "
              >
                <view class="detail-actions__button-content">
                  <wd-icon
                    :name="
                      executionContext?.unloadingStatus === 'completed'
                        ? 'check-circle'
                        : 'upload'
                    "
                    size="30rpx"
                  />
                  <text>{{
                    executionContext?.unloadingStatus === "completed"
                      ? "办理签收"
                      : "填写卸货信息"
                  }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isSigned || needsReturnCompletion"
                class="detail-actions__primary detail-actions__primary--wide"
                custom-class="tms-primary-action"
                type="primary"
                :round="false"
                :disabled="actionBusy"
                @click.stop="openExecutionOperation('completion')"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="check" size="30rpx" />
                  <text>{{
                    isCompleted ? "补录收车信息" : "录入收车信息"
                  }}</text>
                </view>
              </wd-button>
              <wd-button
                v-else-if="isCompleted"
                class="detail-actions__receipt"
                custom-class="tms-secondary-action"
                type="primary"
                plain
                :round="false"
                @click.stop="viewReceipt"
              >
                <view class="detail-actions__button-content">
                  <wd-icon name="view" size="30rpx" />
                  <text>查看运输单据</text>
                </view>
              </wd-button>
            </view>
            <wd-button
              v-if="canReportExpense"
              class="detail-actions__expense"
              custom-class="tms-secondary-action"
              type="primary"
              plain
              :round="false"
              @click.stop="openExpense"
            >
              <view class="detail-actions__button-content">
                <wd-icon name="add-circle" size="30rpx" />
                <text>费用上报</text>
              </view>
            </wd-button>
          </view>
        </TmsRouteCard>

        <view class="detail-tabs card" role="tablist" aria-label="运单详情视图">
          <button
            class="detail-tabs__item"
            :class="{ 'is-active': activeDetailTab === 'tracking' }"
            role="tab"
            :aria-selected="activeDetailTab === 'tracking'"
            @click="activeDetailTab = 'tracking'"
          >
            <TmsIcon name="document" size="28rpx" />
            <text>运单跟踪</text>
            <i v-if="waybill.events.length" class="detail-tabs__count">
              {{ waybill.events.length }}
            </i>
          </button>
          <button
            class="detail-tabs__item"
            :class="{ 'is-active': activeDetailTab === 'trajectory' }"
            role="tab"
            :aria-selected="activeDetailTab === 'trajectory'"
            @click="activeDetailTab = 'trajectory'"
          >
            <TmsIcon name="location" size="28rpx" />
            <text>轨迹定位</text>
          </button>
        </view>

        <WaybillTrackingTimeline
          v-if="activeDetailTab === 'tracking'"
          :waybill="current"
          :events="waybill.events"
          :expenses="expenseRecords"
          :sync-warning="trackingWarning"
        />
        <WaybillTrajectoryPanel
          v-else
          :waybill="current"
          :events="waybill.events"
        />

        <view class="info-card card">
          <view class="section-head">
            <view>
              <text class="section-eyebrow">货物档案</text>
              <text class="section-title">货物信息</text>
            </view>
            <text class="section-head__hint">{{
              current.cargoName || "运输货物"
            }}</text>
          </view>
          <view class="info-list">
            <view
              v-for="row in cargoRows"
              :key="row.label"
              class="info-list__row"
            >
              <text>{{ row.label }}</text>
              <text>{{ row.value }}</text>
            </view>
          </view>
        </view>

        <view class="info-card card">
          <view class="section-head">
            <view>
              <text class="section-eyebrow">运输站点</text>
              <text class="section-title">站点与联系人</text>
            </view>
            <text class="section-head__hint">可快捷拨号</text>
          </view>
          <view class="station-list">
            <view
              v-for="row in stationRows"
              :key="row.label"
              class="station-list__row"
            >
              <text class="station-list__label">{{ row.label }}</text>
              <view class="station-list__main">
                <view class="station-list__head">
                  <text class="station-list__station">{{ row.station }}</text>
                  <text class="station-list__name">{{ row.name }}</text>
                </view>
                <text class="station-list__phone">{{
                  maskPhone(row.phone)
                }}</text>
                <text class="station-list__address">{{ row.address }}</text>
              </view>
              <wd-button
                class="station-list__call"
                type="icon"
                :aria-label="`拨打${row.label}电话`"
                custom-style="width: 50rpx; min-width: 50rpx; height: 50rpx; padding: 0; border-radius: 50%; background: #25bf75; color: #fff;"
                @click="callPhone(row.phone)"
              >
                <wd-icon name="phone" size="30rpx" />
              </wd-button>
            </view>
          </view>
        </view>

        <view v-if="waybill.proofs.length" class="proof-card card">
          <view class="section-head">
            <view>
              <text class="section-eyebrow">凭证资料</text>
              <text class="section-title">运输单据</text>
            </view>
            <text class="section-head__hint"
              >{{ waybill.proofs.length }} 份</text
            >
          </view>
          <view class="proof-card__grid">
            <image
              v-for="proof in waybill.proofs"
              :key="proof.id"
              class="proof-card__image"
              :src="proof.fileUrl"
              mode="aspectFill"
              @tap="viewReceipt"
            />
          </view>
        </view>
      </view>
      <view v-else class="detail-page__state card">
        <view class="detail-page__state-icon">
          <wd-loading
            v-if="waybill.loading"
            type="ring"
            color="#4f46e5"
            size="58rpx"
          />
          <TmsIcon v-else name="document" size="62rpx" />
        </view>
        <text class="detail-page__state-title">
          {{ waybill.loading ? "正在加载任务详情" : "暂时无法显示任务" }}
        </text>
        <text class="detail-page__state-hint">
          {{
            waybill.loading
              ? "正在同步运输节点、货物与站点信息"
              : "请返回运单列表后重新进入"
          }}
        </text>
      </view>
    </scroll-view>

    <view v-if="current && isPending" class="pending-footer">
      <view>
        <text class="pending-footer__label">运费：</text>
        <text class="pending-footer__money">{{
          formatMoney(current.freightAmount)
        }}</text>
      </view>
      <wd-button
        class="pending-footer__button"
        custom-class="tms-primary-action"
        type="primary"
        :round="false"
        :disabled="actionBusy"
        @click="accept"
      >
        <view class="detail-actions__button-content">
          <wd-loading
            v-if="activeAction === 'accept'"
            type="ring"
            color="#ffffff"
            size="30rpx"
          />
          <wd-icon v-else name="check-circle" size="32rpx" />
          <text>{{
            activeAction === "accept" ? "正在接受任务" : "确认接受任务"
          }}</text>
        </view>
      </wd-button>
    </view>

    <WaybillSignatureSheet
      v-model="signatureVisible"
      :waybill="current"
      @success="handleSignatureSuccess"
    />
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100vh;
  overflow: hidden;
  background: #f4f6fa;
}

.detail-page__blue {
  color: #fff;
  background: linear-gradient(135deg, #292266 0%, #4f46e5 56%, #2563eb 118%);
}

.detail-page__status {
  margin: 0 28rpx;
  padding: 22rpx 22rpx 28rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.detail-page__status-icon {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.11);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-page__status-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.2;
}

.detail-page__hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  opacity: 0.72;
}

.detail-page__scroll {
  height: calc(100vh - 298rpx);
}

.detail-page__scroll--header-only {
  height: calc(100vh - 176rpx);
}

.detail-page--pending .detail-page__scroll {
  height: calc(100vh - 298rpx - 128rpx - env(safe-area-inset-bottom));
}

.detail-page__content {
  padding: 24rpx 28rpx 58rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-page--pending .detail-page__content {
  padding-top: 26rpx;
  padding-bottom: 34rpx;
}

.detail-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 8rpx;
}

.detail-tabs__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  min-width: 0;
  min-height: 92rpx;
  margin: 0;
  padding: 0 14rpx;
  color: #657188;
  background: transparent;
  border-radius: 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
  touch-action: manipulation;
}

.detail-tabs__item > :deep(.tms-icon) {
  flex: 0 0 28rpx;
  width: 28rpx !important;
  min-width: 28rpx;
  height: 28rpx !important;
  min-height: 28rpx;
}

.detail-tabs__item::after {
  border: 0;
}

.detail-tabs__item.is-active {
  color: #4338ca;
  background: linear-gradient(135deg, #f0efff, #edf3ff);
  box-shadow: inset 0 0 0 1rpx rgba(79, 70, 229, 0.12);
}

.detail-tabs__item.is-active::before {
  position: absolute;
  right: 26rpx;
  bottom: 0;
  left: 26rpx;
  height: 5rpx;
  content: "";
  background: linear-gradient(90deg, #5b55f5, #2563eb);
  border-radius: 999rpx;
}

.detail-tabs__count {
  flex: 0 0 auto;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  color: #fff;
  background: #ef5350;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-style: normal;
  line-height: 34rpx;
  text-align: center;
}

.section-title {
  display: block;
  margin-top: 7rpx;
  color: #172033;
  font-size: 32rpx;
  font-weight: 800;
}

.detail-actions {
  margin-top: 32rpx;
  padding-top: 26rpx;
  border-top: 1rpx solid #edf0f5;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-actions__helper {
  min-height: 58rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  color: #4f46e5;
  background: #f3f4ff;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.4;
}

.detail-actions__helper text {
  min-width: 0;
  flex: 1;
}

.detail-actions__helper--success {
  color: #047857;
  background: #ecfdf5;
}

.detail-actions__controls {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.section-head__hint {
  max-width: 260rpx;
  overflow: hidden;
  color: #748096;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-actions__primary,
.detail-actions__outline {
  min-width: 0;
}

.detail-actions__primary {
  min-width: 0;
  flex: 1;
}

.detail-actions__primary--wide {
  width: 100%;
}

.detail-actions__outline {
  flex: 0 0 176rpx;
}

.detail-actions__receipt {
  width: 100%;
}

.detail-actions__expense {
  width: 100%;
}

.detail-actions__button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  white-space: nowrap;
}

.detail-actions__button-content text {
  white-space: nowrap;
}

.detail-actions__primary.is-disabled,
.detail-actions__outline.is-disabled,
.pending-footer__button.is-disabled {
  opacity: 0.68;
  box-shadow: none;
}

.info-card,
.proof-card {
  padding: 30rpx;
  border-radius: 24rpx;
}

.info-list {
  margin-top: 22rpx;
  padding-top: 8rpx;
}

.info-list__row {
  min-height: 70rpx;
  border-bottom: 1rpx solid #e8ecf3;
  color: #748096;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  font-size: 26rpx;
}

.info-list__row text:last-child {
  color: #172033;
  font-weight: 700;
  text-align: right;
}

.station-list {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-list__row:last-child {
  border-bottom: 0;
}

.station-list__row {
  min-width: 0;
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 54rpx;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #e8ecf3;
}

.station-list__row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.station-list__label {
  color: #748096;
  font-size: 26rpx;
  line-height: 1.2;
}

.station-list__main {
  min-width: 0;
  color: #172033;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.station-list__head {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  align-items: center;
  gap: 12rpx;
}

.station-list__station,
.station-list__name,
.station-list__phone {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.station-list__phone {
  color: #172033;
  font-weight: 800;
  line-height: 1.2;
}

.station-list__address {
  color: #748096;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.station-list__call {
  width: 50rpx;
  height: 50rpx;
  min-width: 50rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: #10b981;
  box-shadow: 0 10rpx 20rpx rgba(16, 185, 129, 0.2);
}

.proof-card__grid {
  margin-top: 26rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.proof-card__image {
  width: 100%;
  height: 150rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
}

.detail-page__state {
  margin: 38rpx 28rpx;
  min-height: 360rpx;
  padding: 44rpx;
  color: #748096;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  text-align: center;
}

.detail-page__state-icon {
  width: 112rpx;
  height: 112rpx;
  margin-bottom: 8rpx;
  border-radius: 34rpx;
  color: #4f46e5;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-page__state-title {
  color: #172033;
  font-size: 29rpx;
  font-weight: 800;
}

.detail-page__state-hint {
  max-width: 470rpx;
  color: #748096;
  font-size: 23rpx;
  line-height: 1.55;
}

.pending-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  min-height: calc(128rpx + env(safe-area-inset-bottom));
  padding: 22rpx 30rpx calc(22rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid #e8ecf3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 26rpx;
  box-shadow: 0 -12rpx 34rpx rgba(32, 40, 66, 0.09);
}

.pending-footer__label {
  color: #172033;
  font-size: 26rpx;
}

.pending-footer__money {
  color: #4f46e5;
  font-size: 34rpx;
  font-weight: 900;
}

.pending-footer__button {
  flex: 0 0 328rpx;
  min-width: 0;
}

.pending-footer__button :deep(.wd-button__content) {
  gap: 10rpx;
}
</style>
