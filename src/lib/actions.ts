'use server';

import { getErpAI } from './erpai';
import type { TableName } from './tables';

export async function fetchRecords(tableName: TableName, page = 1, pageSize = 50, search?: string) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.list({ page, pageSize, search });
}

export async function fetchRecord(tableName: TableName, id: string) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.get(id);
}

export async function createRecord(tableName: TableName, data: Record<string, unknown>) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.create(data);
}

export async function updateRecord(tableName: TableName, id: string, data: Record<string, unknown>) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.update(id, data);
}

export async function deleteRecord(tableName: TableName, id: string) {
  const app = getErpAI();
  const table = app.table(tableName);
  await table.delete(id);
}

export async function fetchAllRecords(tableName: TableName) {
  const app = getErpAI();
  const table = app.table(tableName);
  const all: Record<string, unknown>[] = [];
  for await (const page of table.listPages({ pageSize: 100 })) {
    all.push(...page.data);
  }
  return all;
}

export async function getTableSchema(tableName: TableName) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.getSchema();
}

export async function fetchRecordsWithFilter(tableName: TableName, filter: Record<string, any>, page = 1, pageSize = 50) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.list({ filter: filter as any, page, pageSize });
}

export async function countRecords(tableName: TableName) {
  const app = getErpAI();
  const table = app.table(tableName);
  return table.count();
}

// Fetch multiple table counts for dashboard
export async function fetchDashboardStats() {
  const app = getErpAI();
  const tables = ['Items', 'Purchase Orders', 'Sales Orders', 'Production Orders', 'Inventory', 'Suppliers', 'Customers', 'Quality Inspections'] as const;
  const results = await Promise.allSettled(
    tables.map(async (t) => {
      const count = await app.table(t).count();
      return { table: t, count };
    })
  );
  const stats: Record<string, number> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') stats[r.value.table] = r.value.count;
  }
  return stats;
}
