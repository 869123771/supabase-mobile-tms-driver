import { defineStore } from 'pinia'
import {
  createWaybillEvent,
  getWaybill,
  listWaybillEvents,
  listWaybillProofs,
  listWaybills,
  updateWaybill,
  uploadWaybillProofFiles,
  type WaybillStatusGroup
} from '@/api/waybill'
import type { ProofFile, Waybill, WaybillEvent, WaybillProof, WaybillStatus } from '@/api/types'
import { useAuthStore } from './auth'
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

const activeStatuses: WaybillStatus[] = ['accepted', 'loading', 'transporting', 'unloading']

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
    activeCount: (state) => state.list.filter((item) => activeStatuses.includes(item.status)).length,
    completedCount: (state) => state.list.filter((item) => item.status === 'completed').length
  },
  actions: {
    async ensureSession() {
      const auth = useAuthStore()
      auth.hydrate()
      if (!auth.token) {
        uni.reLaunch({ url: '/pages/login/index' })
        throw new Error('请先登录')
      }
      if (auth.isTokenExpired) await auth.refreshSession()
      return auth
    },
    async loadList(group?: WaybillStatusGroup) {
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const summary = await profile.load()
      const targetGroup = group || this.activeGroup
      this.activeGroup = targetGroup
      this.loading = true
      try {
        this.list = await listWaybills(auth.token, {
          group: targetGroup,
          driverId: summary?.driver?.id
        })
        return this.list
      } finally {
        this.loading = false
      }
    },
    async loadHomeTask() {
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const summary = await profile.load()
      const driverId = summary?.driver?.id
      const active = await listWaybills(auth.token, {
        group: 'active',
        driverId,
        limit: 1
      })
      const pending = active.length
        ? []
        : await listWaybills(auth.token, {
            group: 'pending',
            driverId,
            limit: 1
          })
      this.currentTask = active[0] || pending[0] || null
      return this.currentTask
    },
    async loadDetail(id: string) {
      const auth = await this.ensureSession()
      this.loading = true
      try {
        this.current = await getWaybill(auth.token, id)
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
    async applyStatus(
      status: WaybillStatus,
      patch: Partial<Waybill>,
      eventType: string,
      payload?: Record<string, unknown>
    ) {
      if (!this.current) throw new Error('运单不存在')
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      try {
        const updated = await updateWaybill(auth.token, this.current.id, {
          ...patch,
          status
        })
        if (updated) this.current = updated
        await createWaybillEvent(auth.token, this.current, eventType, operatorName, payload)
        await this.loadDetail(this.current.id)
        await this.loadHomeTask()
        return this.current
      } finally {
        this.actionLoading = false
      }
    },
    async acceptCurrent() {
      return this.applyStatus(
        'accepted',
        { acceptedAt: new Date().toISOString() },
        'accepted',
        { action: 'accept' }
      )
    },
    async cancelCurrent() {
      return this.applyStatus(
        'cancelled',
        { cancelledAt: new Date().toISOString() },
        'cancelled',
        { action: 'cancel' }
      )
    },
    async uploadPickup(filePaths: string[]) {
      if (!this.current) throw new Error('运单不存在')
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      try {
        const files = await uploadWaybillProofFiles(
          auth.token,
          this.current,
          'pickup',
          filePaths,
          operatorName
        )
        const pickupPhotos = [...(this.current.pickupPhotos || []), ...files]
        const now = new Date().toISOString()
        const updated = await updateWaybill(auth.token, this.current.id, {
          status: 'transporting',
          loadedAt: this.current.loadedAt || now,
          departedAt: this.current.departedAt || now,
          pickupPhotos
        })
        if (updated) this.current = updated
        await createWaybillEvent(auth.token, this.current, 'loaded', operatorName, {
          action: 'upload_pickup',
          fileCount: files.length
        })
        await this.loadDetail(this.current.id)
        await this.loadHomeTask()
        return files
      } finally {
        this.actionLoading = false
      }
    },
    async confirmArrival() {
      return this.applyStatus(
        'unloading',
        { arrivedAt: new Date().toISOString() },
        'arrived',
        { action: 'confirm_arrival' }
      )
    },
    async completeCurrent(filePaths: string[] = []) {
      if (!this.current) throw new Error('运单不存在')
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      try {
        let files: ProofFile[] = []
        if (filePaths.length > 0) {
          files = await uploadWaybillProofFiles(
            auth.token,
            this.current,
            'delivery',
            filePaths,
            operatorName
          )
        }
        const deliveryPhotos = [...(this.current.deliveryPhotos || []), ...files]
        const receiptAttachments = [...(this.current.receiptAttachments || []), ...files]
        const now = new Date().toISOString()
        const updated = await updateWaybill(auth.token, this.current.id, {
          status: 'completed',
          unloadedAt: this.current.unloadedAt || now,
          completedAt: now,
          deliveryPhotos,
          receiptAttachments
        })
        if (updated) this.current = updated
        await createWaybillEvent(auth.token, this.current, 'completed', operatorName, {
          action: 'complete',
          fileCount: files.length
        })
        await this.loadDetail(this.current.id)
        await this.loadHomeTask()
        return this.current
      } finally {
        this.actionLoading = false
      }
    }
  }
})
