import type { CompassQuality } from './compassDiagnostics'

export const MAX_DIAGNOSTIC_SNAPSHOTS = 10
export type DiagnosticSnapshot = {
  timestamp: number
  latitude: number | null; longitude: number | null; locationTimestamp: number | null
  compassHeading: number | null; compassAccuracy: number | null
  northCorrection: number | null; candidateMedian: number | null; candidateRange: number | null
  headingRange: number | null; gravityDifference: number | null
  correctedHeading: number | null; correctedAltitude: number | null
  moonAzimuth: number | null; moonAltitude: number | null
  quality: CompassQuality['status']; qualityReasons: string[]
  candidateCount: number; headingCount: number
  timeMode: 'current' | 'fixed'; observationTime: string | null
  orientationSource: 'manual' | 'sensor'; memo: string
}
export type SnapshotState = { nextId: number; items: (DiagnosticSnapshot & { id: number })[] }
export const INITIAL_SNAPSHOTS: SnapshotState = { nextId: 1, items: [] }
export type SnapshotAction = { type: 'add'; snapshot: DiagnosticSnapshot } | { type: 'delete'; id: number } | { type: 'clear' }

export function snapshotReducer(state: SnapshotState, action: SnapshotAction): SnapshotState {
  if (action.type === 'clear') return { ...state, items: [] }
  if (action.type === 'delete') return { ...state, items: state.items.filter(item => item.id !== action.id) }
  return { nextId: state.nextId + 1, items: [{ ...action.snapshot, qualityReasons: [...action.snapshot.qualityReasons],
    id: state.nextId }, ...state.items].slice(0, MAX_DIAGNOSTIC_SNAPSHOTS) }
}
