import { NextRequest, NextResponse } from 'next/server';

const ERPAI_BASE = 'https://make-api.erpai.dev/api/v1/app-builder';
const DEFAULT_APP_ID = '69957a3c9cf5cf00139a7aa7';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body as { message?: string };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const token = process.env.ERPAI_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Server configuration error: missing ERPAI_TOKEN' },
        { status: 500 }
      );
    }

    const appId = process.env.ERPAI_APP_ID || DEFAULT_APP_ID;

    const response = await fetch(`${ERPAI_BASE}/data-qna`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-app-id': appId,
      },
      body: JSON.stringify({
        appId,
        todo: message.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: Record<string, unknown> | null = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // not JSON
      }

      return NextResponse.json(
        {
          error: errorData && typeof errorData === 'object' && 'message' in errorData
            ? (errorData as { message: string }).message
            : `ERPAI API error (${response.status})`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errMessage}` },
      { status: 500 }
    );
  }
}
