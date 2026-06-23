interface Column<T> {
  header: string;
  key: keyof T | string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  maxHeight?: string;
}

export default function Table<T extends { id: number }>({
  columns,
  data,
  emptyMessage = "No records found.",
  onRowClick,
  maxHeight,
}: TableProps<T>) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-surface-raised"
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      <table className="w-full text-sm">
        <thead className={maxHeight ? "sticky top-0 z-10" : undefined}>
          <tr className="bg-surface border-b border-surface-raised">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-white/30"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-surface-raised/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-white/70 ${col.className ?? ""}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
