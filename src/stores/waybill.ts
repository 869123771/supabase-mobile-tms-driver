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

const activeStatuses: WaybillStatus[] = ['accepted', 'loading', 'transporting', 'unloading', 'signed']

function isJwtExpiredError(error: unknown) {
  return error instanceof Error && /jwt expired/i.test(error.message)
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
    activeCount: (state) => state.list.filter((item) => activeStatuses.includes(item.status)).length,
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
      const latest = active.length || pending.length
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
      if (!['accepted', 'loading'].includes(this.current.status)) {
        throw new Error('当前运单已进入下一运输节点')
      }
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      const waybillId = this.current.id
      try {
        if (this.current.status === 'accepted') {
          const loadingWaybill = await updateWaybill(auth.token, waybillId, { status: 'loading' })
          if (!loadingWaybill) throw new Error('进入装货节点失败')
          this.current = loadingWaybill
        }

        const savedProofFiles: ProofFile[] = this.proofs
          .filter((proof) => proof.proofType === 'pickup_photo')
          .map((proof) => ({
            name: proof.fileName,
            url: proof.fileUrl,
            fileType: proof.mimeType,
            fileSize: proof.fileSize
          }))
        if (filePaths.length === 0 && savedProofFiles.length === 0) {
          throw new Error('请先选择提货照片')
        }

        const files = await uploadWaybillProofFiles(
          auth.token,
          this.current,
          'pickup',
          filePaths,
          operatorName
        )
        const pickupPhotos = Array.from(
          new Map(
            [...(this.current.pickupPhotos || []), ...savedProofFiles, ...files].map((file) => [
              file.url,
              file
            ])
          ).values()
        )
        const now = new Date().toISOString()
        const updated = await updateWaybill(auth.token, waybillId, {
          status: 'loading',
          loadedAt: this.current.loadedAt || now,
          pickupPhotos
        })
        if (!updated) throw new Error('更新运输状态失败')
        this.current = updated
        await createWaybillEvent(auth.token, this.current, 'loaded', operatorName, {
          action: 'upload_pickup',
          fileCount: pickupPhotos.length
        })
        await this.loadDetail(waybillId)
        await this.loadHomeTask()
        return files
      } catch (error) {
        try {
          await this.loadDetail(waybillId)
        } catch {
          // Preserve the original action error.
        }
        throw error
      } finally {
        this.actionLoading = false
      }
    },
    async confirmDeparture() {
      return this.applyStatus(
        'transporting',
        { departedAt: new Date().toISOString() },
        'departed',
        { action: 'confirm_departure' }
      )
    },
    async confirmArrival() {
      return this.applyStatus(
        'unloading',
        { arrivedAt: new Date().toISOString() },
        'arrived',
        { action: 'confirm_arrival' }
      )
    },
    async submitSignature(filePaths: string[] = []) {
      if (!this.current) throw new Error('运单不存在')
      if (this.current.status !== 'unloading') {
        throw new Error('当前运单尚未进入卸货节点')
      }
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      const waybillId = this.current.id
      try {
        const savedProofFiles: ProofFile[] = this.proofs
          .filter((proof) => proof.proofType === 'delivery_photo' || proof.proofType === 'receipt')
          .map((proof) => ({
            name: proof.fileName,
            url: proof.fileUrl,
            fileType: proof.mimeType,
            fileSize: proof.fileSize
          }))
        const files = filePaths.length > 0
          ? await uploadWaybillProofFiles(
            auth.token,
            this.current,
            'delivery',
            filePaths,
            operatorName
          )
          : []
        if (files.length === 0 && savedProofFiles.length === 0) {
          throw new Error('请先选择签收回单照片')
        }
        const deliveryPhotos = Array.from(
          new Map(
            [...(this.current.deliveryPhotos || []), ...savedProofFiles, ...files].map((file) => [
              file.url,
              file
            ])
          ).values()
        )
        const receiptAttachments = Array.from(
          new Map(
            [...(this.current.receiptAttachments || []), ...savedProofFiles, ...files].map((file) => [
              file.url,
              file
            ])
          ).values()
        )
        const now = new Date().toISOString()
        const signedWaybill = await updateWaybill(auth.token, waybillId, {
          status: 'signed',
          unloadedAt: this.current.unloadedAt || now,
          deliveryPhotos,
          receiptAttachments
        })
        if (!signedWaybill) throw new Error('确认签收状态失败')
        this.current = signedWaybill
        await createWaybillEvent(auth.token, this.current, 'signed', operatorName, {
          action: 'submit_signature',
          fileCount: deliveryPhotos.length
        })
        await this.loadDetail(waybillId)
        await this.loadHomeTask()
        return this.current
      } catch (error) {
        try {
          await this.loadDetail(waybillId)
        } catch {
          // Preserve the original action error.
        }
        throw error
      } finally {
        this.actionLoading = false
      }
    },
    async completeCurrent() {
      if (!this.current) throw new Error('运单不存在')
      if (this.current.status !== 'signed') {
        throw new Error('请先提交签收资料，再确认完成运单')
      }
      const auth = await this.ensureSession()
      const profile = useProfileStore()
      const operatorName = profile.driver?.driverName || profile.user?.nickName || profile.user?.userName
      this.actionLoading = true
      const waybillId = this.current.id
      try {
        if (!this.events.some((event) => event.eventType === 'signed')) {
          await createWaybillEvent(auth.token, this.current, 'signed', operatorName, {
            action: 'submit_signature',
            fileCount: this.proofs.filter(
              (proof) => proof.proofType === 'delivery_photo' || proof.proofType === 'receipt'
            ).length,
            recovered: true
          })
        }
        const now = new Date().toISOString()
        const updated = await updateWaybill(auth.token, waybillId, {
          status: 'completed',
          completedAt: now
        })
        if (!updated) throw new Error('完成运单失败')
        this.current = updated
        await createWaybillEvent(auth.token, this.current, 'completed', operatorName, {
          action: 'complete'
        })
        await this.loadDetail(waybillId)
        await this.loadHomeTask()
        return this.current
      } catch (error) {
        try {
          await this.loadDetail(waybillId)
        } catch {
          // Preserve the original action error.
        }
        throw error
      } finally {
        this.actionLoading = false
      }
    }
  }
})
