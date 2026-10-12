import type { Vector3 } from '../../../shared/math/types'
import { diagnosticValue } from '../formatDiagnostics'

export function VectorReadout({ label, vector }: { label: string; vector: Vector3 | null }) {
  return (
    <div className="debug-vector">
      <h3>{label}</h3>
      <dl>{(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis}><dt>{axis}</dt><dd>{diagnosticValue(vector ? vector[axis] : null)}</dd></div>
      ))}</dl>
    </div>
  )
}

