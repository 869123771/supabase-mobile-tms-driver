import type { WaybillStatus } from '@/api/types'

export const STATUS_LABEL: Record<WaybillStatus, string> = {
  pending: '待处理',
  accepted: '待提货',
  loading: '装货中',
  transporting: '运输中',
  unloading: '卸货中',
  completed: '已完成',
  cancelled: '已取消'
}

export const STATUS_TONE: Record<WaybillStatus, 'blue' | 'orange' | 'green' | 'gray' | 'red'> = {
  pending: 'orange',
  accepted: 'blue',
  loading: 'blue',
  transporting: 'blue',
  unloading: 'orange',
  completed: 'green',
  cancelled: 'red'
}

const STATUS_STEP: Record<WaybillStatus, number> = {
  pending: 0,
  accepted: 1,
  loading: 1,
  transporting: 2,
  unloading: 3,
  completed: 4,
  cancelled: 0
}

export function getStatusStep(status?: WaybillStatus) {
  if (!status) return 0
  return STATUS_STEP[status] ?? 0
}

export function formatDuration(minutes?: number) {
  if (!minutes && minutes !== 0) return '--'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}分钟`
  if (rest <= 0) return `${hours}小时`
  return `${hours}小时${rest}分`
}

export function formatKm(value?: number) {
  if (value === undefined || value === null) return '--'
  return `${Number(value).toFixed(1)}km`
}

export function formatMoney(value?: number) {
  if (value === undefined || value === null) return '¥0.00'
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function formatTon(value?: number) {
  if (value === undefined || value === null) return '--'
  return `${Number(value).toLocaleString('zh-CN')}吨`
}

export function formatMeters(value?: number) {
  if (value === undefined || value === null) return '--'
  const meters = Number(value) > 100 ? Number(value) / 1000 : Number(value)
  return `${meters.toFixed(meters >= 10 ? 1 : 2)}米`
}

export function formatDateTime(value?: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export function maskPhone(value?: string) {
  if (!value) return '--'
  return value.replace(/^(\d{3})\d{4}(\d+)/, '$1****$2')
}

export function maskIdCard(value?: string) {
  if (!value) return '--'
  return value.replace(/^(.{6}).+(.{2})$/, '$1******$2')
}

export function shortName(value?: string) {
  if (!value) return '司机'
  return value.length > 3 ? value.slice(-3) : value
}

export function todayLabel() {
  const date = new Date()
  return `${date.getMonth() + 1}/${date.getDate()}`
}
