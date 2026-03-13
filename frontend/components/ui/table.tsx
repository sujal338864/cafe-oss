import * as React from "react"

export function Table({ children, className }: any) {
  return <table className={className}>{children}</table>
}

export function TableHeader({ children, className }: any) {
  return <thead className={className}>{children}</thead>
}

export function TableBody({ children }: any) {
  return <tbody>{children}</tbody>
}

export function TableRow({ children, className }: any) {
  return <tr className={className}>{children}</tr>
}

export function TableHead({ children, className }: any) {
  return <th className={className}>{children}</th>
}

export function TableCell({ children, className }: any) {
  return <td className={className}>{children}</td>
}
