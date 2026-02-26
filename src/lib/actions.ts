'use server';

import {
  listRecords,
  getRecord,
  createRecordApi,
  updateRecordApi,
  deleteRecordApi,
  countRecordsApi,
  listAllRecords,
} from './erpai';
import type { TableName } from './tables';

export async function fetchRecords(tableName: TableName, page = 1, pageSize = 50, search?: string) {
  return listRecords(tableName, page, pageSize, search);
}

export async function fetchRecord(tableName: TableName, id: string) {
  return getRecord(tableName, id);
}

export async function createRecord(tableName: TableName, data: Record<string, unknown>) {
  return createRecordApi(tableName, data as Record<string, any>);
}

export async function updateRecord(tableName: TableName, id: string, data: Record<string, unknown>) {
  return updateRecordApi(tableName, id, data as Record<string, any>);
}

export async function deleteRecord(tableName: TableName, id: string) {
  return deleteRecordApi(tableName, id);
}

export async function fetchAllRecords(tableName: TableName) {
  return listAllRecords(tableName);
}

export async function countRecords(tableName: TableName) {
  return countRecordsApi(tableName);
}

// Fetch multiple table counts for dashboard
export async function fetchDashboardStats() {
  const tables = [
    'Items', 'Purchase Orders', 'Sales Orders', 'Production Orders',
    'Inventory', 'Suppliers', 'Customers', 'Quality Inspections',
  ] as const;

  const results = await Promise.allSettled(
    tables.map(async (t) => {
      const count = await countRecordsApi(t);
      return { table: t, count };
    })
  );

  const stats: Record<string, number> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') stats[r.value.table] = r.value.count;
  }
  return stats;
}
