export function Table({ children, ...p }: any) { return <table {...p}>{children}</table>; }
export function TableHeader({ children, ...p }: any) { return <thead {...p}>{children}</thead>; }
export function TableBody({ children, ...p }: any) { return <tbody {...p}>{children}</tbody>; }
export function TableRow({ children, ...p }: any) { return <tr {...p}>{children}</tr>; }
export function TableHead({ children, ...p }: any) { return <th {...p}>{children}</th>; }
export function TableCell({ children, ...p }: any) { return <td {...p}>{children}</td>; }