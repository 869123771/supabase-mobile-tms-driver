<script setup lang="ts">
import { computed } from "vue";
import type { Waybill, WaybillEvent } from "@/api/types";
import { formatDateTime } from "@/utils/format";
import { getWaybillRoutePoints } from "@/utils/route";
import TmsIcon from "./TmsIcon.vue";
import TmsRouteMap from "./TmsRouteMap.vue";

interface TraceNode {
  id: string;
  longitude: number;
  latitude: number;
  title: string;
  time?: string;
  location: string;
  source: "measured" | "inferred";
}

const props = withDefaults(
  defineProps<{
    waybill?: Waybill | null;
    events?: WaybillEvent[];
  }>(),
  { events: () => [] },
);

const actionLabels: Record<string, string> = {
  accept: "接受任务",
  loading_checkin: "装货定位打卡",
  complete_loading: "装货完成",
  upload_pickup: "装货凭证上传",
  confirm_departure: "确认发车",
  confirm_arrival: "到达定位打卡",
  complete_unloading: "卸货完成",
  complete_unload: "卸货完成",
  sign: "签收完成",
  submit_signature: "签收完成",
  complete: "确认回场",
  cancel: "取消运单",
};

function validCoordinate(longitude: unknown, latitude: unknown) {
  return (
    typeof longitude === "number" &&
    typeof latitude === "number" &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function eventTitle(event: WaybillEvent) {
  const action = typeof event.payload?.action === "string" ? event.payload.action : "";
  return actionLabels[action] || event.eventType || "业务定位";
}

const measuredNodes = computed<TraceNode[]>(() =>
  [...props.events]
    .filter((event) => validCoordinate(event.longitude, event.latitude))
    .sort(
      (left, right) =>
        new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime(),
    )
    .map((event) => ({
      id: event.id,
      longitude: Number(event.longitude),
      latitude: Number(event.latitude),
      title: eventTitle(event),
      time: event.eventTime,
      location: event.locationText || "设备定位坐标",
      source: "measured" as const,
    })),
);

const inferredNodes = computed<TraceNode[]>(() =>
  getWaybillRoutePoints(props.waybill).map((point, index, source) => ({
    id: `route-${index}`,
    longitude: point.longitude,
    latitude: point.latitude,
    title: index === 0 ? "装货地" : index === source.length - 1 ? "卸货地" : "运输站点",
    location:
      index === 0
        ? props.waybill?.shipperAddress || "装货地运单坐标"
        : props.waybill?.receiverAddress || "卸货地运单坐标",
    source: "inferred" as const,
  })),
);

function samePoint(left: TraceNode, right: TraceNode) {
  return (
    Math.abs(left.longitude - right.longitude) < 0.00001 &&
    Math.abs(left.latitude - right.latitude) < 0.00001
  );
}

const traceNodes = computed(() => {
  if (measuredNodes.value.length >= 2) return measuredNodes.value;
  const combined = [
    inferredNodes.value[0],
    ...measuredNodes.value,
    inferredNodes.value[inferredNodes.value.length - 1],
  ].filter((item): item is TraceNode => Boolean(item));
  return combined.filter(
    (item, index, source) => source.findIndex((candidate) => samePoint(item, candidate)) === index,
  );
});

const mapPoints = computed(() =>
  traceNodes.value.map((item) => ({
    longitude: item.longitude,
    latitude: item.latitude,
  })),
);

const traceDescription = computed(() => {
  if (measuredNodes.value.length >= 2) {
    return "以实测业务节点为途经点规划车行路线；路线用于节点串联展示，不代表司机实际行驶轨迹。";
  }
  if (measuredNodes.value.length === 1) {
    return "结合 1 个实测定位与运单起终点规划车行路线，补全坐标会明确标注来源。";
  }
  return "暂无实测打卡坐标，当前按运单起终点规划车行路线，不作为实际行驶轨迹。";
});
</script>

<template>
  <view class="trajectory-panel card">
    <view class="trajectory-panel__head">
      <view>
        <text class="trajectory-panel__eyebrow">TRACE & LOCATION</text>
        <text class="trajectory-panel__title">节点轨迹与定位</text>
      </view>
      <view class="trajectory-panel__count">{{ traceNodes.length }} 个节点</view>
    </view>

    <view class="trajectory-panel__summary">
      <view>
        <strong>{{ measuredNodes.length }}</strong>
        <text>实测定位</text>
      </view>
      <view>
        <strong>{{ Math.max(0, traceNodes.length - measuredNodes.length) }}</strong>
        <text>坐标补全</text>
      </view>
      <view>
        <strong>{{ events.length }}</strong>
        <text>业务记录</text>
      </view>
    </view>

    <view class="trajectory-panel__map">
      <TmsRouteMap
        :waybill="waybill"
        :points-override="mapPoints"
        route-mode="nodes"
        embedded
      />
      <view class="trajectory-panel__legend">
        <text><i class="is-route" />车行路线</text>
        <text><i class="is-node" />业务节点</text>
      </view>
    </view>

    <view class="trajectory-panel__notice">
      <TmsIcon name="location" size="27rpx" />
      <text>{{ traceDescription }}</text>
    </view>

    <view v-if="traceNodes.length" class="trace-list">
      <view v-for="(node, index) in traceNodes" :key="node.id" class="trace-list__item">
        <view
          class="trace-list__index"
          :class="`is-${node.source}`"
        >
          {{ index + 1 }}
        </view>
        <view class="trace-list__main">
          <view class="trace-list__title-row">
            <strong>{{ node.title }}</strong>
            <text>{{ node.source === "measured" ? "设备定位" : "运单坐标" }}</text>
          </view>
          <text v-if="node.time" class="trace-list__time">{{ formatDateTime(node.time) }}</text>
          <text class="trace-list__location">{{ node.location }}</text>
          <text class="trace-list__coordinate">
            {{ node.longitude.toFixed(6) }}, {{ node.latitude.toFixed(6) }}
          </text>
        </view>
      </view>
    </view>

    <view v-else class="trajectory-panel__empty">
      <TmsIcon name="location" size="48rpx" />
      <strong>暂无可展示的定位坐标</strong>
      <text>后续装货、到达等定位打卡会自动汇入这里。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.trajectory-panel {
  padding: 28rpx 26rpx 30rpx;
}

.trajectory-panel__head,
.trajectory-panel__summary,
.trajectory-panel__legend,
.trajectory-panel__notice,
.trace-list__title-row {
  display: flex;
  align-items: center;
}

.trajectory-panel__head,
.trace-list__title-row {
  justify-content: space-between;
  gap: 18rpx;
}

.trajectory-panel__eyebrow,
.trajectory-panel__title {
  display: block;
}

.trajectory-panel__eyebrow {
  color: #5b55f5;
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.trajectory-panel__title {
  margin-top: 7rpx;
  color: #172033;
  font-size: 30rpx;
  font-weight: 800;
}

.trajectory-panel__count {
  flex: 0 0 auto;
  padding: 9rpx 16rpx;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.trajectory-panel__summary {
  gap: 12rpx;
  margin-top: 24rpx;
}

.trajectory-panel__summary > view {
  flex: 1;
  min-width: 0;
  padding: 17rpx 12rpx;
  text-align: center;
  border: 1rpx solid #edf0f5;
  background: linear-gradient(180deg, #fafbfe 0%, #f5f7fb 100%);
  border-radius: 14rpx;
}

.trajectory-panel__summary strong,
.trajectory-panel__summary text {
  display: block;
}

.trajectory-panel__summary strong {
  color: #172033;
  font-size: 28rpx;
  font-weight: 800;
}

.trajectory-panel__summary text {
  margin-top: 4rpx;
  color: #748096;
  font-size: 19rpx;
}

.trajectory-panel__map {
  position: relative;
  margin-top: 20rpx;
  overflow: hidden;
  border: 1rpx solid #dce3ed;
  border-radius: 20rpx;
  background: #e8eef5;
  box-shadow: 0 10rpx 28rpx rgba(31, 42, 68, 0.07);
}

.trajectory-panel__legend {
  position: absolute;
  right: 14rpx;
  bottom: 14rpx;
  z-index: 4;
  gap: 14rpx;
  padding: 9rpx 13rpx;
  color: #5f6b80;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 999rpx;
  font-size: 18rpx;
  box-shadow: 0 6rpx 18rpx rgba(31, 41, 55, 0.1);
}

.trajectory-panel__legend text {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.trajectory-panel__legend i {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 12rpx;
  height: 12rpx;
}

.trajectory-panel__legend .is-route {
  width: 22rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: #4f46e5;
}

.trajectory-panel__legend .is-node {
  border: 3rpx solid #5b55f5;
  border-radius: 50%;
  background: #fff;
}

.trajectory-panel__notice {
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  color: #52627a;
  background: #f3f6ff;
  border-left: 5rpx solid #5b55f5;
  border-radius: 13rpx;
  font-size: 20rpx;
  line-height: 1.55;
}

.trace-list {
  margin-top: 22rpx;
}

.trace-list__item {
  position: relative;
  display: flex;
  gap: 16rpx;
  padding-bottom: 24rpx;
}

.trace-list__item:not(:last-child)::before {
  position: absolute;
  top: 42rpx;
  bottom: 2rpx;
  left: 19rpx;
  width: 2rpx;
  content: "";
  background: #dfe5f1;
}

.trace-list__index {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  flex: 0 0 40rpx;
  width: 40rpx;
  min-width: 40rpx;
  height: 40rpx;
  min-height: 40rpx;
  aspect-ratio: 1;
  border: 4rpx solid #fff;
  border-radius: 50%;
  color: #fff;
  background: #5b55f5;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 5rpx 14rpx rgba(79, 70, 229, 0.2);
}

.trace-list__index.is-inferred {
  background: #f59e0b;
}

.trace-list__main {
  min-width: 0;
  flex: 1;
  padding: 2rpx 0;
}

.trace-list__title-row strong {
  min-width: 0;
  color: #1c2738;
  font-size: 24rpx;
  overflow-wrap: anywhere;
}

.trace-list__title-row text {
  flex: 0 0 auto;
  color: #66738a;
  font-size: 19rpx;
}

.trace-list__time,
.trace-list__location,
.trace-list__coordinate {
  display: block;
  margin-top: 6rpx;
  color: #6f7c91;
  font-size: 20rpx;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.trace-list__coordinate {
  color: #929bad;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 18rpx;
}

.trajectory-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 54rpx 20rpx 26rpx;
  color: #8994a7;
  text-align: center;
}

.trajectory-panel__empty strong {
  color: #435067;
  font-size: 24rpx;
}

.trajectory-panel__empty text {
  font-size: 20rpx;
}
</style>
