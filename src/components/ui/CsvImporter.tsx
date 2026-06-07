import { useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from './Modal';
import { TextArea } from './TextArea';
import { useToast } from './Toast';

// Importador genérico CSV/Excel.
// Acepta:
//   * Archivo .csv o .tsv (lectura local con FileReader)
//   * Paste directo en textarea (también .xlsx tras "Copiar como tabla"
//     desde Excel — los rangos seleccionados se pegan como TSV)
// Parsea con detección automática de separador (, ; \t) y comillas básicas.

export type ColumnMapping<T> = {
  /** Header del archivo (case-insensitive, trimmed). Varias variantes
   *  posibles separadas por '|' (ej. "fecha|date|Fecha de compra"). */
  headerAlias: string;
  /** Campo en el Insert. */
  field: keyof T;
  /** Transformar el valor del CSV antes de pasar al insert. */
  transform?: (raw: string) => unknown;
  /** Marcar como requerido — si falta o vacío, la fila no se importa. */
  required?: boolean;
};

type ParsedRow = Record<string, string>;

type Props<T extends object> = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Mappings columna del archivo → campo del Insert. */
  mappings: ColumnMapping<T>[];
  /** Callback que inserta UNA fila parseada en la DB. */
  onImportRow: (row: Partial<T>) => Promise<void>;
  /** Texto de ejemplo que se muestra arriba del textarea (un CSV chico). */
  exampleCsv?: string;
};

function detectSeparator(text: string): string {
  const sample = text.slice(0, 500);
  const counts = {
    '\t': (sample.match(/\t/g) ?? []).length,
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
  };
  const best = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

function parseLine(line: string, sep: string): string[] {
  // Parser minimalista con soporte para comillas dobles.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const sep = detectSeparator(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[0], sep);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], sep);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h.toLowerCase().trim()] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function aliasFor<T>(mapping: ColumnMapping<T>): string[] {
  return mapping.headerAlias.split('|').map((s) => s.toLowerCase().trim());
}

function findValue<T>(row: ParsedRow, mapping: ColumnMapping<T>): string {
  for (const a of aliasFor(mapping)) {
    if (row[a] != null && row[a] !== '') return row[a];
  }
  return '';
}

export function CsvImporter<T extends object>({
  open,
  onClose,
  title,
  mappings,
  onImportRow,
  exampleCsv,
}: Props<T>) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: { row: number; err: string }[] } | null>(null);
  const toast = useToast();

  const parsed = useMemo(() => (text ? parseCsv(text) : { headers: [], rows: [] }), [text]);

  const preview = useMemo(() => {
    return parsed.rows.slice(0, 20).map((row) => {
      const mapped: Record<string, unknown> = {};
      const missing: string[] = [];
      for (const m of mappings) {
        const raw = findValue(row, m);
        if (m.required && !raw) missing.push(String(m.field));
        const val = raw === '' ? null : m.transform ? m.transform(raw) : raw;
        mapped[String(m.field)] = val;
      }
      return { mapped, missing };
    });
  }, [parsed, mappings]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.toLowerCase().split('.').pop();
    const reader = new FileReader();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      // Binario: parsea con SheetJS y emite TSV (lo que el parser interno
      // ya soporta vía detectSeparator).
      reader.onload = (ev) => {
        try {
          const buf = ev.target?.result;
          if (!buf) return;
          const wb = XLSX.read(buf, { type: 'array' });
          const firstSheet = wb.SheetNames[0];
          if (!firstSheet) return;
          const sheet = wb.Sheets[firstSheet];
          const tsv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
          setText(tsv);
        } catch (err) {
          toast.error(`Error al leer xlsx: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      // CSV/TSV: lectura como texto UTF-8.
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === 'string') setText(result);
      };
      reader.readAsText(f, 'utf-8');
    }
  }

  async function doImport() {
    setImporting(true);
    const r = { ok: 0, failed: [] as { row: number; err: string }[] };
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const payload: Partial<T> = {};
      let missing = false;
      for (const m of mappings) {
        const raw = findValue(row, m);
        if (m.required && !raw) {
          r.failed.push({ row: i + 2, err: `Falta ${String(m.field)}` });
          missing = true;
          break;
        }
        const val = raw === '' ? null : m.transform ? m.transform(raw) : raw;
        (payload as Record<string, unknown>)[String(m.field)] = val;
      }
      if (missing) continue;
      try {
        await onImportRow(payload);
        r.ok += 1;
      } catch (err) {
        r.failed.push({ row: i + 2, err: (err as Error).message ?? 'error' });
      }
    }
    setResults(r);
    setImporting(false);
    if (r.ok > 0) toast.success(`${r.ok} fila${r.ok === 1 ? '' : 's'} importada${r.ok === 1 ? '' : 's'}.`);
    if (r.failed.length > 0) toast.error(`${r.failed.length} fila${r.failed.length === 1 ? '' : 's'} con error.`);
  }

  function clear() {
    setText('');
    setResults(null);
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-3 text-sm">
        <p className="text-dark-2">
          Pega filas desde Excel (Ctrl+C en el rango → Ctrl+V aquí) o sube un archivo CSV. El
          importer detecta automáticamente el separador (tab, coma o punto y coma).
        </p>

        <div className="rounded-md border border-sand bg-sand-l/30 p-2 text-xs">
          <p className="font-semibold uppercase tracking-wider text-dark-3">Columnas esperadas:</p>
          <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {mappings.map((m) => (
              <li key={String(m.field)} className="flex items-baseline gap-1">
                <span className="font-mono text-dark">{String(m.field)}</span>
                <span className="text-dark-3">·</span>
                <span className="text-dark-2">acepta: {m.headerAlias}</span>
                {m.required && <span className="ml-1 rounded bg-rust-l px-1 text-[10px] text-rust">obligatoria</span>}
              </li>
            ))}
          </ul>
        </div>

        {exampleCsv && (
          <details className="rounded-md border border-teal/40 bg-teal-l/30 p-2 text-xs">
            <summary className="cursor-pointer font-semibold text-teal-d">Ver ejemplo</summary>
            <pre className="mt-2 overflow-x-auto font-mono text-[10px] text-dark-2">{exampleCsv}</pre>
          </details>
        )}

        <input
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,.ods,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={onFileChange}
          className="block w-full rounded border border-sand bg-white px-2 py-1.5 text-xs"
        />
        <p className="text-[10px] text-dark-3">
          Acepta <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong>, <strong>.csv</strong> y <strong>.tsv</strong>. Los binarios se leen con SheetJS (toma la primera hoja).
        </p>

        <TextArea
          name="csv"
          label="O pega aquí las filas (con header en la primera línea)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="font-mono text-xs"
        />

        {parsed.headers.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-dark-3">
              <strong>{parsed.rows.length}</strong> filas detectadas · headers:{' '}
              <span className="font-mono">{parsed.headers.join(' | ')}</span>
            </p>
            <div className="overflow-auto rounded-md border border-sand">
              <table className="min-w-full text-xs">
                <thead className="bg-sand-l">
                  <tr>
                    <th className="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-dark-3">#</th>
                    {mappings.map((m) => (
                      <th key={String(m.field)} className="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-dark-3">
                        {String(m.field)}
                      </th>
                    ))}
                    <th className="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-dark-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {preview.map((p, i) => (
                    <tr key={i} className={p.missing.length > 0 ? 'bg-rust-l/30' : ''}>
                      <td className="px-2 py-1 font-mono text-dark-3">{i + 2}</td>
                      {mappings.map((m) => (
                        <td key={String(m.field)} className="px-2 py-1 font-mono text-dark">
                          {String((p.mapped as Record<string, unknown>)[String(m.field)] ?? '')}
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        {p.missing.length > 0 ? (
                          <span className="text-[10px] text-rust">Falta: {p.missing.join(', ')}</span>
                        ) : (
                          <span className="text-[10px] text-teal-d">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 20 && (
                <p className="border-t border-sand bg-sand-l/30 px-2 py-1 text-[10px] text-dark-3">
                  Mostrando 20 de {parsed.rows.length} filas. La importación procesa todas.
                </p>
              )}
            </div>
          </div>
        )}

        {results && (
          <div className="rounded-md border border-sand bg-sand-l/30 p-3">
            <p className="font-semibold text-dark">Resultados:</p>
            <p className="text-teal-d">✓ {results.ok} importadas</p>
            {results.failed.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-rust">✗ {results.failed.length} con error</summary>
                <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
                  {results.failed.map((f, i) => (
                    <li key={i}>
                      Fila {f.row}: {f.err}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={clear} className="rounded-md border border-sand px-3 py-1.5 text-xs text-dark-2 hover:bg-sand-l">
            Limpiar
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-3 py-1.5 text-xs text-dark-2 hover:bg-sand-l">
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void doImport()}
            disabled={importing || parsed.rows.length === 0}
            className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
          >
            {importing ? 'Importando…' : `⬆ Importar ${parsed.rows.length} fila${parsed.rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
