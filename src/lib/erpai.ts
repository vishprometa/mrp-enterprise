import { ErpAI } from '@erp-ai/sdk';

let _client: ErpAI | null = null;

export function getErpAI(): ErpAI {
  if (!_client) {
    _client = new ErpAI({
      token: process.env.ERPAI_TOKEN!,
      appId: process.env.ERPAI_APP_ID!,
      baseUrl: process.env.ERPAI_BASE_URL,
    });
  }
  return _client;
}
