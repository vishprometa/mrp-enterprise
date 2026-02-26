// Direct API client — no SDK dependency

const BASE_URL = process.env.ERPAI_BASE_URL || 'https://make-api.erpai.dev/api';
const TOKEN = process.env.ERPAI_TOKEN!;
const APP_ID = process.env.ERPAI_APP_ID!;

const HEADERS: Record<string, string> = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'x-app-id': APP_ID,
  'x-api-source': 'sdk',
};

// ── API helper ──────────────────────────────────

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

// ── Schema Cache ────────────────────────────────

interface ColumnMeta {
  id: string;
  name: string;
  type: string;
  options?: { id: number; name: string }[];
  refTable?: { _id: string; name: string };
}

interface TableMeta {
  _id: string;
  name: string;
  columnsMetaData: ColumnMeta[];
}

const tableCache = new Map<string, TableMeta>();

async function resolveTable(tableName: string): Promise<TableMeta> {
  const cached = tableCache.get(tableName);
  if (cached) return cached;

  const res = await api('GET', `/v1/app-builder/table?appId=${APP_ID}&searchQuery=${encodeURIComponent(tableName)}`);
  const tables: TableMeta[] = res.data || [];
  const table = tables.find((t: TableMeta) => t.name === tableName);
  if (!table) throw new Error(`Table "${tableName}" not found`);

  tableCache.set(tableName, table);
  return table;
}

// ── Transform: API → friendly (column IDs → names, selects → strings) ──

function transformIncoming(record: any, columns: ColumnMeta[]): Record<string, any> {
  const colById = new Map(columns.map(c => [c.id, c]));
  const result: Record<string, any> = { id: record._id };

  if (record.createdAt) result.createdAt = record.createdAt;
  if (record.modifiedAt) result.updatedAt = record.modifiedAt;

  const cells = record.cells || {};
  for (const [colId, rawVal] of Object.entries(cells)) {
    const col = colById.get(colId);
    if (!col) continue;

    let val: any = rawVal;

    if (col.type === 'select' && Array.isArray(val) && col.options) {
      const opt = col.options.find(o => o.id === val[0]);
      val = opt ? opt.name : val[0] ?? null;
    } else if (col.type === 'multi-select' && Array.isArray(val) && col.options) {
      val = val.map((id: number) => {
        const opt = col.options!.find(o => o.id === id);
        return opt ? opt.name : String(id);
      });
    } else if (col.type === 'boolean') {
      val = Array.isArray(val) ? val[0] === 1 : !!val;
    } else if (col.type === 'ref' && Array.isArray(val)) {
      val = val[0] ?? null;
    }

    result[col.name] = val;
  }

  return result;
}

// ── Transform: friendly → API (column names → IDs, strings → option IDs) ──

const READ_ONLY_TYPES = new Set(['formula', 'rollup', 'auto_seq', 'seq_format_id', 'ai_column', 'auto_fill']);

function transformOutgoing(data: Record<string, any>, columns: ColumnMeta[]): Record<string, any> {
  const colByName = new Map(columns.map(c => [c.name, c]));
  const cells: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    if (['id', 'createdAt', 'updatedAt', 'createdBy'].includes(key)) continue;
    const col = colByName.get(key);
    if (!col || READ_ONLY_TYPES.has(col.type)) continue;

    if (col.type === 'select' && typeof val === 'string' && col.options) {
      const opt = col.options.find(o => o.name === val);
      cells[col.id] = opt ? [opt.id] : val;
    } else if (col.type === 'multi-select' && Array.isArray(val) && col.options) {
      cells[col.id] = val.map((v: string) => {
        const opt = col.options!.find(o => o.name === v);
        return opt ? opt.id : v;
      });
    } else if (col.type === 'boolean') {
      cells[col.id] = [val ? 1 : 0];
    } else if (col.type === 'ref') {
      cells[col.id] = Array.isArray(val) ? val : val ? [val] : [];
    } else {
      cells[col.id] = val;
    }
  }

  return cells;
}

// ── Public API ──────────────────────────────────

export async function listRecords(
  tableName: string,
  page = 1,
  pageSize = 50,
  search?: string
): Promise<{ data: Record<string, any>[]; totalCount: number }> {
  const table = await resolveTable(tableName);
  const qs = `pageNo=${page}&pageSize=${pageSize}${search ? `&q=${encodeURIComponent(search)}` : ''}`;
  const filter = { logicalOperator: 'and', conditions: [], ids: [] };

  const res = await api('POST', `/v1/app-builder/table/${table._id}/paged-record?${qs}`, filter);

  const data = (res.data || []).map((r: any) => transformIncoming(r, table.columnsMetaData));
  return { data, totalCount: res.totalCount ?? data.length };
}

export async function getRecord(tableName: string, id: string): Promise<Record<string, any>> {
  const table = await resolveTable(tableName);
  const res = await api('GET', `/v1/app-builder/table/${table._id}/record/${id}`);
  const raw = Array.isArray(res) ? res[0] : res;
  return transformIncoming(raw, table.columnsMetaData);
}

export async function createRecordApi(tableName: string, data: Record<string, any>): Promise<any> {
  const table = await resolveTable(tableName);
  const cells = transformOutgoing(data, table.columnsMetaData);
  return api('POST', `/v1/app-builder/table/${table._id}/record`, { cells });
}

export async function updateRecordApi(tableName: string, id: string, data: Record<string, any>): Promise<any> {
  const table = await resolveTable(tableName);
  const cells = transformOutgoing(data, table.columnsMetaData);
  return api('PUT', `/v1/app-builder/table/${table._id}/record/${id}`, { cells });
}

export async function deleteRecordApi(tableName: string, id: string): Promise<void> {
  const table = await resolveTable(tableName);
  await api('DELETE', `/v1/app-builder/table/${table._id}/record/${id}`);
}

export async function countRecordsApi(tableName: string): Promise<number> {
  const table = await resolveTable(tableName);
  const res = await api('POST', `/v1/app-builder/table/${table._id}/paged-record?pageNo=1&pageSize=1`, {
    logicalOperator: 'and', conditions: [], ids: [],
  });
  return res.totalCount ?? 0;
}

export async function listAllRecords(tableName: string): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await listRecords(tableName, page, pageSize);
    all.push(...res.data);
    if (all.length >= res.totalCount || res.data.length < pageSize) break;
    page++;
  }

  return all;
}
