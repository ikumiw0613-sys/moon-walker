import type { Matrix3 } from '../../../shared/math/types'

export function MatrixReadout({ label, matrix }: { label: string; matrix: Matrix3 | null }) {
  return (
    <div className="debug-matrix">
      <h3>{label}</h3>
      {matrix ? <table aria-label={label}><tbody>{matrix.map((row, index) => (
        <tr key={index}>{row.map((value, column) => <td key={column}>{value.toFixed(2)}</td>)}</tr>
      ))}</tbody></table> : <p className="search-status">null (向きの入力待ち)</p>}
    </div>
  )
}

