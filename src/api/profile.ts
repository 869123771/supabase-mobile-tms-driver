import { rpc } from './supabase'
import { getRoutePointsDistanceKm } from '@/utils/route'
import type { ProfileSummary, Waybill } from './types'

export async function getProfileSummary(token: string) {
  const [summary, completedWaybills] = await Promise.all([
    rpc<ProfileSummary>(token, 'tms_get_driver_mobile_profile', {}),
    rpc<Waybill[]>(token, 'tms_list_driver_mobile_waybills', {
      p_group: 'completed',
      p_limit: 1000
    })
  ])

  return {
    ...summary,
    completedCount: completedWaybills.length,
    totalMileageKm: Number(
      completedWaybills
        .reduce((total, item) => {
          const routeDistance = getRoutePointsDistanceKm(item.routePoints)
          return total + (routeDistance ?? item.remainingDistanceKm ?? 0)
        }, 0)
        .toFixed(1)
    )
  } satisfies ProfileSummary
}
