<script setup lang="ts">
import { computed } from "vue";
import type {
  DriverExpenseRecord,
  Waybill,
  WaybillEvent,
} from "@/api/types";
import { formatDateTime, formatMoney } from "@/utils/format";

type TimelineTone = "blue" | "green" | "orange" | "red" | "gray";

interface TimelineItem {
  id: string;
  title: string;
  description: string;
  eventTime?: string;
  recordedAt?: string;
  operator?: string;
  source: string;
  location?: string;
  remark?: string;
  metrics: string[];
  attachments: string[];
  tone: TimelineTone;
  keyAction?: string;
}

const props = defineProps<{
  waybill: Waybill;
  events: WaybillEvent[];
  expenses?: DriverExpenseRecord[];
  syncWarning?: string;
}>();

const actionMeta: Record<
  string,
  { title: string; description: string; tone: TimelineTone; keyAction?: string }
> = {
  assigned: {
    title: "运输任务已派发",
    description: "运单进入司机端，等待确认接受任务",
    tone: "gray",
  },
  accept: {
    title: "确认接受任务",
    description: "司机已接单，运输任务正式开始",
    tone: "green",
    keyAction: "accepted",
  },
  loading_checkin: {
    title: "装货定位打卡",
    description: "已获取定位并完成装货地打卡",
    tone: "blue",
  },
  complete_loading: {
    title: "装货信息已提交",
    description: "装货净重、可选毛皮重、现场照片与磅单已归档",
    tone: "green",
    keyAction: "loaded",
  },
  upload_pickup: {
    title: "装货凭证已上传",
    description: "装货现场资料已归档",
    tone: "green",
    keyAction: "loaded",
  },
  confirm_departure: {
    title: "发车信息已提交",
    description: "发车时间、出车里程与车辆照片已记录",
    tone: "blue",
    keyAction: "departed",
  },
  confirm_arrival: {
    title: "到达定位打卡",
    description: "已获取定位并完成到货地打卡",
    tone: "blue",
    keyAction: "arrived",
  },
  complete_unloading: {
    title: "卸货信息已提交",
    description: "卸货净重、可选毛皮重、现场照片与磅单已归档",
    tone: "green",
    keyAction: "unloaded",
  },
  complete_unload: {
    title: "卸货信息已提交",
    description: "卸货作业资料已归档",
    tone: "green",
    keyAction: "unloaded",
  },
  sign: {
    title: "签收完成",
    description: "签收人、回单与签字凭证已归档",
    tone: "green",
    keyAction: "signed",
  },
  submit_signature: {
    title: "签收完成",
    description: "签收信息与回单已归档",
    tone: "green",
    keyAction: "signed",
  },
  web_sign: {
    title: "Web 端确认签收",
    description: "调度端已完成签收归档",
    tone: "green",
    keyAction: "signed",
  },
  complete: {
    title: "确认回场",
    description: "收车时间、里程与车辆照片已记录，运输闭环完成",
    tone: "green",
    keyAction: "completed",
  },
  repair_completion: {
    title: "补录回场信息",
    description: "历史缺失的收车档案与车辆里程台账已补齐",
    tone: "orange",
    keyAction: "completed",
  },
  cancel: {
    title: "运单已取消",
    description: "运输任务已终止",
    tone: "red",
  },
};

const eventTypeFallback: Record<string, (typeof actionMeta)[string]> = {
  created: actionMeta.assigned!,
  accepted: actionMeta.accept!,
  loading_checked_in: actionMeta.loading_checkin!,
  loaded: actionMeta.complete_loading!,
  departed: actionMeta.confirm_departure!,
  arrived: actionMeta.confirm_arrival!,
  unloaded: actionMeta.complete_unloading!,
  signed: actionMeta.sign!,
  completed: actionMeta.complete!,
  cancelled: actionMeta.cancel!,
  photo_uploaded: {
    title: "运输凭证已上传",
    description: "现场影像已归档",
    tone: "blue",
  },
  status_changed: {
    title: "运单状态已更新",
    description: "运输节点状态发生变化",
    tone: "gray",
  },
};

const auditLabel: Record<DriverExpenseRecord["auditStatus"], string> = {
  draft: "草稿",
  pending_review: "审批中",
  approved: "已通过",
  rejected: "已驳回",
  voided: "已作废",
};

const keyActionTotal = 7;

function payloadText(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function payloadNumber(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadBoolean(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "boolean" ? value : null;
}

function sourceLabel(event: WaybillEvent) {
  const source = payloadText(event.payload, "source");
  if (source === "driver") return "司机端";
  if (source === "web") return "Web 端";
  return event.operatorName ? "操作记录" : "系统";
}

function eventMetrics(event: WaybillEvent) {
  const payload = event.payload;
  const values: string[] = [];
  const weight = payloadNumber(payload, "weightTon");
  const grossWeight = payloadNumber(payload, "grossWeightTon");
  const tareWeight = payloadNumber(payload, "tareWeightTon");
  const odometer = payloadNumber(payload, "odometerKm");
  const returnOdometer = payloadNumber(payload, "returnOdometerKm");
  const mileage = payloadNumber(payload, "runningMileageKm");
  const photos = payloadNumber(payload, "photoCount");
  const tickets = payloadNumber(payload, "ticketCount");
  const receipts = payloadNumber(payload, "receiptCount");
  const signatures = payloadNumber(payload, "signatureCount");
  const signer = payloadText(payload, "signerName");
  const inside = payloadBoolean(payload, "insideGeofence");
  const distance = payloadNumber(payload, "distanceM");

  if (weight !== null) values.push(`净重 ${weight.toLocaleString("zh-CN")} 吨`);
  if (grossWeight !== null) values.push(`毛重 ${grossWeight.toLocaleString("zh-CN")} 吨`);
  if (tareWeight !== null) values.push(`皮重 ${tareWeight.toLocaleString("zh-CN")} 吨`);
  if (payloadBoolean(payload, "hasRecognitionInfo")) values.push("含 OCR 识别原文");
  if (odometer !== null) values.push(`出车里程 ${odometer.toLocaleString("zh-CN")} km`);
  if (returnOdometer !== null)
    values.push(`收车里程 ${returnOdometer.toLocaleString("zh-CN")} km`);
  if (mileage !== null) values.push(`本次行驶 ${mileage.toLocaleString("zh-CN")} km`);
  if (signer) values.push(`签收人 ${signer}`);
  if (photos !== null) values.push(`${photos} 张现场照片`);
  if (tickets !== null) values.push(`${tickets} 张磅单`);
  if (receipts !== null) values.push(`${receipts} 张回单`);
  if (signatures !== null) values.push(`${signatures} 张签字照片`);
  if (inside !== null) values.push(inside ? "围栏内打卡" : "围栏外打卡");
  if (distance !== null) values.push(`距作业点约 ${Math.round(distance)} 米`);
  return values;
}

function mapEvent(event: WaybillEvent): TimelineItem {
  const action = payloadText(event.payload, "action");
  const meta =
    actionMeta[action] ||
    eventTypeFallback[event.eventType] || {
      title: "运输节点已更新",
      description: "运单产生一笔新的操作记录",
      tone: "gray" as const,
    };
  return {
    id: `event-${event.id}`,
    title: meta.title,
    description: meta.description,
    eventTime: event.eventTime,
    recordedAt: event.createTime,
    operator: event.operatorName,
    source: sourceLabel(event),
    location: event.locationText,
    remark: event.remark,
    metrics: eventMetrics(event),
    attachments: [],
    tone: meta.tone,
    keyAction: meta.keyAction,
  };
}

function mapExpense(record: DriverExpenseRecord): TimelineItem {
  const status = auditLabel[record.auditStatus];
  return {
    id: `expense-${record.id}`,
    title: `费用上报 · ${record.expenseItemName}`,
    description: `${formatMoney(record.amount)} · ${status}`,
    eventTime: record.submittedAt || record.createTime,
    recordedAt: record.createTime,
    source: "司机端",
    location: record.expenseLocation || undefined,
    remark: record.remark || record.reviewRemark || undefined,
    metrics: [`发生日期 ${record.occurredOn}`, `${record.attachments.length} 张凭证`],
    attachments: record.attachments,
    tone:
      record.auditStatus === "approved"
        ? "green"
        : record.auditStatus === "rejected" || record.auditStatus === "voided"
          ? "red"
          : "blue",
  };
}

const timeline = computed(() => {
  const items = [
    ...props.events.map(mapEvent),
    ...(props.expenses || []).map(mapExpense),
  ];
  if (!props.events.some((event) => event.eventType === "created") && props.waybill.createTime) {
    const assignedMeta = actionMeta.assigned!;
    items.push({
      id: `assigned-${props.waybill.id}`,
      title: assignedMeta.title,
      description: assignedMeta.description,
      eventTime: props.waybill.createTime,
      recordedAt: props.waybill.createTime,
      source: "系统",
      metrics: [],
      attachments: [],
      tone: assignedMeta.tone,
    });
  }
  return items.sort((left, right) => {
    const leftTime = left.eventTime ? new Date(left.eventTime).getTime() : 0;
    const rightTime = right.eventTime ? new Date(right.eventTime).getTime() : 0;
    return rightTime - leftTime;
  });
});

const completedKeyActionCount = computed(
  () =>
    new Set(timeline.value.map((item) => item.keyAction).filter(Boolean)).size,
);

function shouldShowRecordedAt(item: TimelineItem) {
  if (!item.recordedAt || !item.eventTime) return false;
  const recorded = new Date(item.recordedAt).getTime();
  const occurred = new Date(item.eventTime).getTime();
  return Number.isFinite(recorded) && Number.isFinite(occurred) && Math.abs(recorded - occurred) > 60_000;
}

function preview(item: TimelineItem, index: number) {
  if (!item.attachments.length) return;
  uni.previewImage({
    current: item.attachments[index],
    urls: item.attachments,
  });
}
</script>

<template>
  <view class="tracking-card card">
    <view class="tracking-card__head">
      <view>
        <text class="section-eyebrow">运单跟踪</text>
        <text class="section-title">全流程记录</text>
      </view>
      <view class="tracking-card__count">
        <strong>{{ timeline.length }}</strong>
        <text>条记录</text>
      </view>
    </view>

    <view class="tracking-card__summary">
      <wd-icon name="check-circle" size="28rpx" />
      <text>已记录 {{ completedKeyActionCount }}/{{ keyActionTotal }} 个关键节点，费用与补录记录按提交时间同步展示</text>
    </view>
    <view v-if="syncWarning" class="tracking-card__warning">
      <wd-icon name="warning" size="28rpx" />
      <text>{{ syncWarning }}</text>
    </view>

    <view v-if="timeline.length" class="tracking-list">
      <view
        v-for="(item, index) in timeline"
        :key="item.id"
        class="tracking-item"
        :class="`tracking-item--${item.tone}`"
      >
        <view class="tracking-item__rail" aria-hidden="true">
          <view class="tracking-item__dot">
            <wd-icon
              :name="item.tone === 'green' ? 'check' : item.tone === 'red' ? 'close' : 'time'"
              size="20rpx"
            />
          </view>
          <view v-if="index < timeline.length - 1" class="tracking-item__line" />
        </view>

        <view class="tracking-item__content">
          <view class="tracking-item__time-row">
            <text>{{ formatDateTime(item.eventTime) }}</text>
            <text class="tracking-item__source">{{ item.source }}</text>
          </view>
          <view class="tracking-item__panel">
            <view class="tracking-item__title-row">
              <strong>{{ item.title }}</strong>
              <text v-if="item.operator" class="tracking-item__operator">{{ item.operator }}</text>
            </view>
            <text class="tracking-item__description">{{ item.description }}</text>

            <view v-if="item.metrics.length" class="tracking-item__metrics">
              <text v-for="metric in item.metrics" :key="metric">{{ metric }}</text>
            </view>

            <view v-if="item.location" class="tracking-item__detail">
              <wd-icon name="location" size="24rpx" />
              <text>{{ item.location }}</text>
            </view>
            <view v-if="item.remark" class="tracking-item__remark">
              <text>备注</text>
              <strong>{{ item.remark }}</strong>
            </view>

            <view v-if="item.attachments.length" class="tracking-item__images">
              <button
                v-for="(url, imageIndex) in item.attachments.slice(0, 3)"
                :key="url"
                :aria-label="`查看${item.title}第 ${imageIndex + 1} 张凭证`"
                @click="preview(item, imageIndex)"
              >
                <image :src="url" mode="aspectFill" lazy-load />
                <text v-if="imageIndex === 2 && item.attachments.length > 3">
                  +{{ item.attachments.length - 3 }}
                </text>
              </button>
            </view>

            <text v-if="shouldShowRecordedAt(item)" class="tracking-item__recorded">
              系统记录于 {{ formatDateTime(item.recordedAt) }}
            </text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="tracking-card__empty">
      <wd-icon name="time" size="40rpx" />
      <strong>暂无跟踪记录</strong>
      <text>完成运输节点后，操作时间与资料摘要会显示在这里</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tracking-card {
  padding: 30rpx 28rpx 14rpx;
}

.tracking-card__head,
.tracking-item__time-row,
.tracking-item__title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.tracking-card__count {
  flex: 0 0 auto;
  color: var(--tms-muted);
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  font-size: 21rpx;
}

.tracking-card__count strong {
  color: var(--tms-primary);
  font-size: 32rpx;
  font-variant-numeric: tabular-nums;
}

.tracking-card__summary {
  margin-top: 22rpx;
  padding: 16rpx 18rpx;
  border-radius: 16rpx;
  color: #315ea8;
  background: #eef5ff;
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
}

.tracking-card__summary text {
  min-width: 0;
  flex: 1;
}

.tracking-card__warning {
  margin-top: 12rpx;
  padding: 15rpx 18rpx;
  border-radius: 14rpx;
  color: #9a5c0b;
  background: #fff7e8;
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.45;
}

.tracking-card__warning text {
  min-width: 0;
  flex: 1;
}

.tracking-list {
  margin-top: 26rpx;
}

.tracking-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 44rpx minmax(0, 1fr);
  gap: 16rpx;
}

.tracking-item__rail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tracking-item__dot {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  flex: 0 0 40rpx;
  width: 40rpx;
  min-width: 40rpx;
  height: 40rpx;
  min-height: 40rpx;
  aspect-ratio: 1;
  border: 4rpx solid #eef2ff;
  border-radius: 50%;
  color: #fff;
  background: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tracking-item__dot :deep(.wd-icon) {
  box-sizing: border-box;
  flex: 0 0 20rpx;
  width: 20rpx;
  min-width: 20rpx;
  height: 20rpx;
  min-height: 20rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1 !important;
}

.tracking-item__dot :deep(.wd-icon::before) {
  line-height: 1 !important;
}

.tracking-item--green .tracking-item__dot {
  border-color: #d9f6eb;
  background: var(--tms-green);
}

.tracking-item--orange .tracking-item__dot {
  border-color: #fff0d5;
  background: var(--tms-orange);
}

.tracking-item--red .tracking-item__dot {
  border-color: #fde3e5;
  background: var(--tms-red);
}

.tracking-item--gray .tracking-item__dot {
  border-color: #edf0f5;
  color: #fff;
  background: #8b97aa;
}

.tracking-item__line {
  width: 2rpx;
  min-height: 100%;
  flex: 1;
  background: linear-gradient(#d8e0ed 0%, #e7ebf2 100%);
}

.tracking-item__content {
  min-width: 0;
  padding-bottom: 28rpx;
}

.tracking-item__time-row {
  min-height: 40rpx;
  color: var(--tms-muted);
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
}

.tracking-item__source {
  flex: 0 0 auto;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  color: var(--tms-primary);
  background: #eef2ff;
  font-size: 19rpx;
  font-weight: 700;
}

.tracking-item__panel {
  min-width: 0;
  margin-top: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--tms-line);
  border-radius: 20rpx;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  box-shadow: 0 8rpx 22rpx rgba(31, 42, 68, 0.035);
}

.tracking-item__title-row {
  align-items: flex-start;
}

.tracking-item__title-row strong {
  min-width: 0;
  color: var(--tms-text);
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.35;
}

.tracking-item__operator {
  max-width: 180rpx;
  overflow: hidden;
  color: var(--tms-muted);
  font-size: 21rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tracking-item__description {
  display: block;
  margin-top: 8rpx;
  color: var(--tms-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.tracking-item__metrics {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.tracking-item__metrics text {
  padding: 7rpx 12rpx;
  border-radius: 10rpx;
  color: #46546b;
  background: #f0f3f8;
  font-size: 20rpx;
  font-weight: 650;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.tracking-item__detail {
  min-width: 0;
  margin-top: 15rpx;
  color: #66738a;
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  font-size: 21rpx;
  line-height: 1.5;
}

.tracking-item__detail text {
  min-width: 0;
  flex: 1;
  word-break: break-word;
}

.tracking-item__remark {
  min-width: 0;
  margin-top: 14rpx;
  padding: 12rpx 14rpx;
  border-left: 5rpx solid #f0a12c;
  border-radius: 8rpx;
  color: #76531e;
  background: #fff7e8;
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  font-size: 21rpx;
  line-height: 1.45;
}

.tracking-item__remark text {
  flex: 0 0 auto;
  font-weight: 700;
}

.tracking-item__remark strong {
  min-width: 0;
  font-weight: 600;
  word-break: break-word;
}

.tracking-item__images {
  margin-top: 16rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.tracking-item__images button {
  position: relative;
  width: 100%;
  height: 126rpx;
  min-height: 88rpx;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 14rpx;
  background: #edf1f7;
}

.tracking-item__images button::after {
  display: none;
}

.tracking-item__images image {
  width: 100%;
  height: 100%;
  display: block;
}

.tracking-item__images button > text {
  position: absolute;
  inset: 0;
  color: #fff;
  background: rgba(21, 32, 51, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 800;
}

.tracking-item__recorded {
  display: block;
  margin-top: 15rpx;
  padding-top: 13rpx;
  border-top: 1rpx dashed #dfe5ee;
  color: #8a95a7;
  font-size: 20rpx;
  font-variant-numeric: tabular-nums;
}

.tracking-card__empty {
  min-height: 230rpx;
  color: var(--tms-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  text-align: center;
}

.tracking-card__empty strong {
  color: var(--tms-text);
  font-size: 26rpx;
}

.tracking-card__empty text {
  max-width: 470rpx;
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
