<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { getDriverExpenseContext } from "@/api/expense";
import { getUserFacingErrorMessage } from "@/api/supabase";
import type {
  DriverExpenseAuditStatus,
  DriverExpenseContext,
  DriverExpenseRecord,
} from "@/api/types";
import TmsIcon from "@/components/business/TmsIcon.vue";
import TmsPageSkeleton from "@/components/business/TmsPageSkeleton.vue";
import TmsTopBar from "@/components/business/TmsTopBar.vue";
import WaybillExpenseSheet from "@/components/business/WaybillExpenseSheet.vue";
import { useAuthStore } from "@/stores/auth";
import { formatDateTime, formatMoney } from "@/utils/format";

const auth = useAuthStore();
const id = ref("");
const context = ref<DriverExpenseContext>();
const loading = ref(false);
const error = ref("");
const sheetVisible = ref(false);
const editingRecord = ref<DriverExpenseRecord | null>(null);
const shouldAutoCreate = ref(false);

const records = computed(() => context.value?.records || []);
const stats = computed(
  () =>
    context.value?.stats || {
      reportCount: 0,
      totalAmount: 0,
      pendingCount: 0,
      approvedAmount: 0,
    },
);

const statusMeta: Record<
  DriverExpenseAuditStatus,
  { label: string; tone: string; hint: string }
> = {
  draft: { label: "草稿", tone: "gray", hint: "尚未提交审批" },
  pending_review: {
    label: "审批中",
    tone: "blue",
    hint: "财务人员正在审核",
  },
  approved: { label: "已通过", tone: "green", hint: "已纳入运单费用" },
  rejected: { label: "已驳回", tone: "red", hint: "请修改后重新提交" },
  voided: { label: "已作废", tone: "gray", hint: "该记录不再参与结算" },
};

onLoad((query) => {
  id.value = String(query?.id || "");
  shouldAutoCreate.value = String(query?.create || "") === "1";
});

onShow(() => {
  if (id.value && !sheetVisible.value) void load();
});

async function load() {
  if (!id.value || loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    context.value = await getDriverExpenseContext(auth.token, id.value);
    if (shouldAutoCreate.value) {
      shouldAutoCreate.value = false;
      openCreate();
    }
  } catch (requestError) {
    error.value = getUserFacingErrorMessage(
      requestError,
      "费用信息加载失败，请稍后重试",
    );
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!context.value?.canReport) {
    uni.showToast({ title: "当前运单状态不允许上报费用", icon: "none" });
    return;
  }
  if (!context.value.expenseItems.length) {
    uni.showToast({ title: "暂无可用费用项目，请联系管理员", icon: "none" });
    return;
  }
  editingRecord.value = null;
  sheetVisible.value = true;
}

function openEdit(record: DriverExpenseRecord) {
  if (record.auditStatus !== "rejected") return;
  editingRecord.value = record;
  sheetVisible.value = true;
}

function previewAttachments(record: DriverExpenseRecord, index: number) {
  uni.previewImage({
    current: record.attachments[index],
    urls: record.attachments,
  });
}

async function handleSuccess() {
  editingRecord.value = null;
  await load();
}
</script>

<template>
  <view class="expense-page page">
    <TmsTopBar
      title="费用上报"
      eyebrow="WAYBILL EXPENSES"
      :subtitle="context?.waybill.waybillNo || '同步运单费用与审批状态'"
      show-back
      :show-menu="false"
    />

    <scroll-view scroll-y class="expense-page__scroll">
      <TmsPageSkeleton
        v-if="loading || error"
        label="正在同步费用项目与审批记录…"
        :error="error"
        @retry="load"
      />

      <view v-else-if="context" class="expense-page__content">
        <view class="expense-waybill card">
          <view class="expense-waybill__top">
            <view class="expense-waybill__icon">
              <TmsIcon name="waybill" size="36rpx" />
            </view>
            <view class="expense-waybill__copy">
              <text>关联运单</text>
              <strong>{{ context.waybill.waybillNo }}</strong>
            </view>
            <view
              class="expense-waybill__status"
              :class="{
                'expense-waybill__status--disabled': !context.canReport,
              }"
            >
              {{ context.canReport ? "可上报" : "不可上报" }}
            </view>
          </view>
          <view class="expense-waybill__route">
            <view class="expense-waybill__station">
              <view class="expense-waybill__station-head">
                <text class="expense-waybill__station-badge">起</text>
                <strong>{{ context.waybill.originCity || "--" }}</strong>
              </view>
              <small>{{ context.waybill.shipperAddress || "--" }}</small>
            </view>
            <view class="expense-waybill__line">
              <TmsIcon name="arrow-right" size="24rpx" />
            </view>
            <view class="expense-waybill__station expense-waybill__station--end">
              <view class="expense-waybill__station-head">
                <text class="expense-waybill__station-badge">终</text>
                <strong>{{ context.waybill.destinationCity || "--" }}</strong>
              </view>
              <small>{{ context.waybill.receiverAddress || "--" }}</small>
            </view>
          </view>
        </view>

        <view class="expense-stats">
          <view class="expense-stats__item">
            <text>累计上报</text>
            <strong>{{ formatMoney(stats.totalAmount) }}</strong>
            <small>{{ stats.reportCount }} 笔记录</small>
          </view>
          <view class="expense-stats__item expense-stats__item--pending">
            <text>审批中</text>
            <strong>{{ stats.pendingCount }}</strong>
            <small>等待财务处理</small>
          </view>
          <view class="expense-stats__item expense-stats__item--approved">
            <text>已通过</text>
            <strong>{{ formatMoney(stats.approvedAmount) }}</strong>
            <small>已纳入运单成本</small>
          </view>
        </view>

        <view v-if="!context.canReport" class="expense-page__notice expense-page__notice--warning">
          <wd-icon name="warning" size="32rpx" />
          <text>当前运单尚未接受或已经取消，暂不能上报费用。</text>
        </view>
        <view v-else class="expense-page__notice">
          <wd-icon name="info-circle" size="32rpx" />
          <text>司机提交后，Web 端会在运单费用和审批中心同步看到同一条记录。</text>
        </view>

        <view class="expense-section-head">
          <view>
            <text>REPORT HISTORY</text>
            <strong>费用上报记录</strong>
          </view>
          <small class="expense-section-head__count">{{ records.length }} 条</small>
        </view>

        <view v-if="records.length" class="expense-records">
          <view
            v-for="record in records"
            :key="record.id"
            class="expense-record card"
            :class="`expense-record--${statusMeta[record.auditStatus].tone}`"
          >
            <view class="expense-record__head">
              <view>
                <text>{{ record.expenseParentName || "运单费用" }}</text>
                <strong>{{ record.expenseItemName }}</strong>
              </view>
              <view
                class="expense-record__tag"
                :class="`expense-record__tag--${statusMeta[record.auditStatus].tone}`"
              >
                {{ statusMeta[record.auditStatus].label }}
              </view>
            </view>
            <view class="expense-record__amount-row">
              <strong>{{ formatMoney(record.amount) }}</strong>
              <text>发生日期 {{ record.occurredOn }}</text>
            </view>
            <view class="expense-record__meta">
              <text>单号 {{ record.costNo }}</text>
              <text>{{ statusMeta[record.auditStatus].hint }}</text>
            </view>
            <view
              v-if="record.reviewRemark"
              class="expense-record__review"
              :class="{
                'expense-record__review--rejected': record.auditStatus === 'rejected',
              }"
            >
              <wd-icon
                :name="record.auditStatus === 'rejected' ? 'warning' : 'info-circle'"
                size="27rpx"
              />
              <text>{{ record.reviewRemark }}</text>
            </view>
            <view v-if="record.attachments.length" class="expense-record__proofs">
              <button
                v-for="(url, index) in record.attachments.slice(0, 3)"
                :key="url"
                :aria-label="`查看第 ${index + 1} 张费用凭证`"
                @click="previewAttachments(record, index)"
              >
                <image :src="url" mode="aspectFill" />
                <text v-if="index === 2 && record.attachments.length > 3">
                  +{{ record.attachments.length - 3 }}
                </text>
              </button>
            </view>
            <view class="expense-record__footer">
              <text>提交于 {{ formatDateTime(record.submittedAt || record.createTime) }}</text>
              <button
                v-if="record.auditStatus === 'rejected'"
                @click="openEdit(record)"
              >
                修改并重新提交
              </button>
            </view>
          </view>
        </view>

        <view v-else class="expense-empty card">
          <view class="expense-empty__icon">
            <TmsIcon name="document" size="58rpx" />
          </view>
          <strong>暂无费用上报</strong>
          <text>途中产生垫付费用后，可在这里上传票据并提交财务审批。</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="context?.canReport && !loading && !error" class="expense-footer">
      <view>
        <text>票据真实完整，审批更高效</text>
        <strong>运单费用与 Web 实时同步</strong>
      </view>
      <wd-button
        custom-class="tms-primary-action"
        type="primary"
        :round="false"
        @click="openCreate"
      >
        <view class="expense-footer__button-content">
          <wd-icon name="add" size="30rpx" />
          <text>新增费用</text>
        </view>
      </wd-button>
    </view>

    <WaybillExpenseSheet
      v-model="sheetVisible"
      :waybill="context?.waybill || null"
      :expense-items="context?.expenseItems || []"
      :record="editingRecord"
      @success="handleSuccess"
    />
  </view>
</template>

<style scoped lang="scss">
.expense-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.expense-page__scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}

.expense-page__content {
  padding: 24rpx 28rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.expense-waybill {
  padding: 26rpx 24rpx 24rpx;
}

.expense-waybill__top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.expense-waybill__icon {
  box-sizing: border-box;
  flex: 0 0 62rpx;
  width: 62rpx;
  min-width: 62rpx;
  height: 62rpx;
  min-height: 62rpx;
  aspect-ratio: 1;
  border-radius: 18rpx;
  color: var(--tms-primary);
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expense-waybill__copy {
  min-width: 0;
  flex: 1;
}

.expense-waybill__copy text,
.expense-waybill__copy strong {
  display: block;
}

.expense-waybill__copy text {
  color: var(--tms-muted);
  font-size: 21rpx;
}

.expense-waybill__copy strong {
  margin-top: 3rpx;
  overflow: hidden;
  color: var(--tms-text);
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-waybill__status {
  flex: 0 0 auto;
  height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  color: #047857;
  background: #ecfdf5;
  display: flex;
  align-items: center;
  font-size: 21rpx;
  font-weight: 800;
}

.expense-waybill__status--disabled {
  color: #667085;
  background: #f2f4f7;
}

.expense-waybill__route {
  margin-top: 22rpx;
  padding: 20rpx;
  border: 1rpx solid #e8edf4;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #fbfcff, #f5f7fb);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54rpx minmax(0, 1fr);
  align-items: start;
  gap: 10rpx;
}

.expense-waybill__station {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.expense-waybill__station-head {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.expense-waybill__station--end {
  align-items: flex-end;
  text-align: right;
}

.expense-waybill__station--end .expense-waybill__station-head {
  flex-direction: row-reverse;
}

.expense-waybill__station-badge {
  box-sizing: border-box;
  flex: 0 0 38rpx;
  width: 38rpx;
  min-width: 38rpx;
  height: 38rpx;
  min-height: 38rpx;
  aspect-ratio: 1;
  border-radius: 12rpx;
  color: #fff;
  background: #10b981;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 38rpx;
  text-align: center;
}

.expense-waybill__station--end .expense-waybill__station-badge {
  background: #f59e0b;
}

.expense-waybill__station strong,
.expense-waybill__station small {
  min-width: 0;
  max-width: 100%;
}

.expense-waybill__station strong {
  overflow: hidden;
  color: var(--tms-text);
  font-size: 25rpx;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-waybill__station small {
  min-height: 58rpx;
  overflow: hidden;
  color: var(--tms-muted);
  font-size: 20rpx;
  line-height: 1.45;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.expense-waybill__line {
  position: relative;
  align-self: start;
  height: 38rpx;
  margin-top: 1rpx;
  color: var(--tms-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.expense-waybill__line::before {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2rpx;
  content: "";
  background: linear-gradient(90deg, #d8dfed, #9fb4f8, #d8dfed);
  transform: translateY(-50%);
}

.expense-waybill__line :deep(.tms-icon) {
  position: relative;
  z-index: 1;
  box-sizing: content-box;
  padding: 5rpx;
  border: 1rpx solid #dbe3ff;
  border-radius: 50%;
  background: #fff;
}

.expense-stats {
  margin-top: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.22fr) minmax(0, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.expense-stats__item {
  min-width: 0;
  padding: 17rpx 18rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 18rpx;
  background: #f4f6ff;
}

.expense-stats__item:first-child {
  grid-row: 1 / span 2;
  padding: 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(145deg, #f4f4ff 0%, #eef4ff 100%);
}

.expense-stats__item--pending {
  border-color: #fde7bf;
  background: #fffbeb;
}

.expense-stats__item--approved {
  border-color: #cceede;
  background: #ecfdf5;
}

.expense-stats__item text,
.expense-stats__item strong,
.expense-stats__item small {
  display: block;
}

.expense-stats__item text,
.expense-stats__item small {
  color: var(--tms-muted);
  font-size: 19rpx;
}

.expense-stats__item strong {
  margin: 6rpx 0 4rpx;
  overflow: hidden;
  color: var(--tms-text);
  font-size: 27rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.expense-page__notice {
  margin-top: 0;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  color: #3157bd;
  background: #edf3ff;
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  font-size: 22rpx;
  line-height: 1.5;
}

.expense-page__notice--warning {
  color: #9a5b08;
  background: #fff7e8;
}

.expense-section-head {
  margin: 12rpx 4rpx -4rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.expense-section-head text,
.expense-section-head strong {
  display: block;
}

.expense-section-head text {
  color: var(--tms-primary);
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 1.6rpx;
}

.expense-section-head strong {
  margin-top: 5rpx;
  color: var(--tms-text);
  font-size: 30rpx;
}

.expense-section-head small {
  color: var(--tms-muted);
  font-size: 21rpx;
}

.expense-section-head__count {
  flex: 0 0 auto;
  padding: 7rpx 14rpx;
  border: 1rpx solid #e2e7ef;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.76);
}

.expense-records {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.expense-record {
  padding: 26rpx;
  border-left: 5rpx solid #98a2b3;
}

.expense-record--blue {
  border-left-color: #4f46e5;
}

.expense-record--green {
  border-left-color: #10b981;
}

.expense-record--red {
  border-left-color: #ef4444;
}

.expense-record__head,
.expense-record__amount-row,
.expense-record__meta,
.expense-record__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.expense-record__head > view:first-child {
  min-width: 0;
}

.expense-record__head text,
.expense-record__head strong {
  display: block;
}

.expense-record__head text {
  color: var(--tms-muted);
  font-size: 20rpx;
}

.expense-record__head strong {
  margin-top: 4rpx;
  color: var(--tms-text);
  font-size: 28rpx;
}

.expense-record__tag {
  flex: 0 0 auto;
  height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  color: #667085;
  background: #f2f4f7;
  display: flex;
  align-items: center;
  font-size: 20rpx;
  font-weight: 800;
}

.expense-record__tag--blue {
  color: #4338ca;
  background: #eef2ff;
}

.expense-record__tag--green {
  color: #047857;
  background: #ecfdf5;
}

.expense-record__tag--red {
  color: #b42318;
  background: #fff1f0;
}

.expense-record__amount-row {
  margin-top: 22rpx;
  flex-wrap: wrap;
}

.expense-record__amount-row strong {
  color: var(--tms-primary);
  font-size: 38rpx;
  font-weight: 900;
}

.expense-record__amount-row text,
.expense-record__meta,
.expense-record__footer {
  color: var(--tms-muted);
  font-size: 20rpx;
}

.expense-record__meta {
  margin-top: 10rpx;
}

.expense-record__review {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 14rpx;
  color: #475467;
  background: #f6f8fb;
  display: flex;
  align-items: flex-start;
  gap: 9rpx;
  font-size: 21rpx;
  line-height: 1.45;
}

.expense-record__review--rejected {
  color: #b42318;
  background: #fff1f0;
}

.expense-record__proofs {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.expense-record__proofs button {
  position: relative;
  width: 100%;
  aspect-ratio: 1.5;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 14rpx;
  background: #eef1f5;
}

.expense-record__proofs button::after,
.expense-record__footer button::after {
  border: 0;
}

.expense-record__proofs image {
  width: 100%;
  height: 100%;
}

.expense-record__proofs button > text {
  position: absolute;
  inset: 0;
  color: #fff;
  background: rgba(17, 24, 39, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
}

.expense-record__footer {
  min-height: 62rpx;
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #edf0f5;
}

.expense-record__footer button {
  min-height: 58rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.24);
  border-radius: 999rpx;
  color: var(--tms-primary);
  background: #f7f8ff;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 58rpx;
}

.expense-empty {
  min-height: 318rpx;
  padding: 42rpx 34rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.expense-empty__icon {
  width: 104rpx;
  height: 104rpx;
  border-radius: 32rpx;
  color: var(--tms-primary);
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expense-empty strong {
  margin-top: 22rpx;
  color: var(--tms-text);
  font-size: 29rpx;
}

.expense-empty > text {
  max-width: 500rpx;
  margin-top: 10rpx;
  color: var(--tms-muted);
  font-size: 23rpx;
  line-height: 1.55;
}

.expense-footer {
  flex: 0 0 auto;
  min-height: 128rpx;
  padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e8edf4;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  box-shadow: 0 -10rpx 30rpx rgba(32, 40, 66, 0.08);
}

.expense-footer > view:first-child {
  min-width: 0;
  flex: 1;
}

.expense-footer > view:first-child text,
.expense-footer > view:first-child strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-footer > view:first-child text {
  color: var(--tms-muted);
  font-size: 20rpx;
}

.expense-footer > view:first-child strong {
  margin-top: 4rpx;
  color: var(--tms-text);
  font-size: 24rpx;
}

.expense-footer :deep(.wd-button) {
  flex: 0 0 270rpx;
}

.expense-footer__button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

@media screen and (max-width: 420px) {
  .expense-waybill__route {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .expense-waybill__station--end {
    align-items: flex-start;
    text-align: left;
  }

  .expense-waybill__station--end .expense-waybill__station-head {
    flex-direction: row;
  }

  .expense-waybill__station small {
    min-height: 0;
    padding-left: 48rpx;
  }

  .expense-waybill__line {
    width: 38rpx;
    height: 34rpx;
    margin: 0;
  }

  .expense-waybill__line::before {
    top: 0;
    bottom: 0;
    left: 18rpx;
    right: auto;
    width: 2rpx;
    height: auto;
    background: linear-gradient(#d8dfed, #9fb4f8, #d8dfed);
    transform: none;
  }

  .expense-waybill__line :deep(.tms-icon) {
    display: none;
  }

  .expense-footer > view:first-child {
    display: none;
  }

  .expense-footer :deep(.wd-button) {
    flex: 1;
  }
}
</style>
