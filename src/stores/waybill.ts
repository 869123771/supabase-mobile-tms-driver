import { defineStore } from 'pinia'
import {
  acceptAssignedWaybill,
  cancelAssignedWaybill,
  getWaybill,
  listWaybillEvents,
  listWaybillProofs,
  listWaybills,
  type WaybillStatusGroup
} from '@/api/waybill'
import type { Waybill, WaybillEvent, WaybillProof, WaybillStatus } from '@/api/types'
import { syncDriverWaybills } from '@/api/supabase'
import { useAuthStore } from './auth'
import { useDictionaryStore } from './dictionary'
import { useProfileStore } from './profile'

interface WaybillState {
  list: Waybill[]
  current: Waybill | null
  currentTask: Waybill | null
  events: WaybillEvent[]
  proofs: WaybillProof[]
  loading: boolean
  actionLoading: boolean
  activeGroup: WaybillStatusGroup
}

const activeStatuses: WaybillStatus[] = [
  'accepted',
  'loading',
  'transporting',
  'unloading',
  'signed'
]

function isJwtExpiredError(error: unknown) {
  return error instanceof Error && /jwt expired|登录已过期/i.test(error.message)
}

export const useWaybillStore = defineStore('waybill', {
  state: (): WaybillState => ({
    list: [],
    current: null,
    currentTask: null,
    events: [],
    proofs: [],
    loading: false,
    actionLoading: false,
    activeGroup: 'all'
  }),
  getters: {
    pendingCount: (state) => state.list.filter((item) => item.status === 'pending').length,
    activeCount: (state) =>
      state.list.filter((item) => activeStatuses.includes(item.status)).length,
    completedCount: (state) => state.list.filter((item) => item.status === 'completed').length
  },
  actions: {
    async syncAssignedWaybills(
      token: string,
      identities: {
        driverId?: string
        driverPhone?: string
        driverName?: string
        vehicleId?: string
      } = {}
    ) {
      try {
        await syncDriverWaybills(token)
      } catch (error) {
        console.warn('sync driver waybills failed', error)
      }
    },
    async ensureSession() {
      const auth = useAuthStore()
      if (!(await auth.ensureValidSession())) throw new Error('请先登录')
      return auth
    },
    async loadList(group?: WaybillStatusGroup) {
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const summary = await profile.load(true)
      const targetGroup = group || this.activeGroup
      const driver = summary?.driver
      const user = summary?.user
      const vehicle = summary?.vehicle
      this.activeGroup = targetGroup
      this.loading = true
      try {
        await this.syncAssignedWaybills(auth.token, {
          driverId: driver?.id,
          driverPhone: driver?.phone || user?.userPhone || auth.user?.phone,
          driverName: driver?.driverName || user?.nickName || user?.userName,
          vehicleId: vehicle?.id
        })
        this.list = await listWaybills(auth.token, {
          group: targetGroup,
          driverId: driver?.id,
          driverPhone: driver?.phone || user?.userPhone || auth.user?.phone,
          driverName: driver?.driverName || user?.nickName || user?.userName,
          vehicleId: vehicle?.id
        })
        return this.list
      } finally {
        this.loading = false
      }
    },
    async loadHomeTask() {
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const summary = await profile.load(true)
      const driver = summary?.driver
      const user = summary?.user
      const vehicle = summary?.vehicle
      const driverId = driver?.id
      const driverPhone = driver?.phone || user?.userPhone || auth.user?.phone
      const driverName = driver?.driverName || user?.nickName || user?.userName
      const vehicleId = vehicle?.id
      await this.syncAssignedWaybills(auth.token, {
        driverId,
        driverPhone,
        driverName,
        vehicleId
      })
      const active = await listWaybills(auth.token, {
        group: 'active',
        driverId,
        driverPhone,
        driverName,
        vehicleId,
        limit: 1
      })
      const pending = active.length
        ? []
        : await listWaybills(auth.token, {
            group: 'pending',
            driverId,
            driverPhone,
            driverName,
            vehicleId,
            limit: 1
          })
      const latest =
        active.length || pending.length
          ? []
          : await listWaybills(auth.token, {
              group: 'all',
              driverId,
              driverPhone,
              driverName,
              vehicleId,
              limit: 1
            })
      this.currentTask = active[0] || pending[0] || latest[0] || null
      return this.currentTask
    },
    async loadDetail(id: string) {
      const auth = await this.ensureSession()
      this.loading = true
      try {
        await useDictionaryStore().load(auth.token)
        try {
          this.current = await getWaybill(auth.token, id)
        } catch (error) {
          if (!isJwtExpiredError(error)) throw error
          await auth.refreshSession()
          this.current = await getWaybill(auth.token, id)
        }
        if (this.current) {
          this.events = await listWaybillEvents(auth.token, id)
          this.proofs = await listWaybillProofs(auth.token, id)
        } else {
          this.events = []
          this.proofs = []
        }
        return this.current
      } finally {
        this.loading = false
      }
    },
    async acceptCurrent() {
      if (!this.current) throw new Error('运单不存在')
      const auth = await this.ensureSession()
      this.actionLoading = true
      try {
        await acceptAssignedWaybill(auth.token, this.current.id)
        await this.loadDetail(this.current.id)
        await this.loadHomeTask()
        return this.current
      } finally {
        this.actionLoading = false
      }
    },
    async cancelCurrent(reason: string) {
      if (!this.current) throw new Error('运单不存在')
      const auth = await this.ensureSession()
      this.actionLoading = true
      try {
        await cancelAssignedWaybill(auth.token, this.current.id, reason)
        await this.loadDetail(this.current.id)
        await this.loadHomeTask()
        return this.current
      } finally {
        this.actionLoading = false
      }
    }
  }
})
