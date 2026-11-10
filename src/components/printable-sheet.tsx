export interface PrintableColumn {
  header: string;
  key: string;
  numeric?: boolean;
}

// Hidden on screen, shown only when printing (see .print-only / .print-area
// in admin.css) — a clean plain table instead of whatever dashboard-style
// cards/donuts/filters happen to be on screen, which wouldn't print well.
export function PrintableSheet({
  title,
  subtitle,
  columns,
  rows,
  totals,
}: {
  title: string;
  subtitle?: string;
  columns: PrintableColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number | null>;
}) {
  return (
    <div className="print-only print-area print-sheet">
      <h1>{title}</h1>
      {subtitle && <p className="print-sheet-subtitle">{subtitle}</p>}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.numeric ? "num" : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "num" : undefined}>
                  {row[c.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "num" : undefined}>
                  {totals[c.key] ?? ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
