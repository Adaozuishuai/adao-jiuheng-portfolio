import { NextResponse } from 'next/server';
import { ConfigurationError } from './runtime';

export async function apiError(error: unknown) {
  if (error instanceof Response) return NextResponse.json({ error: (await error.text()) || '请求无效' }, { status: error.status });
  if (error instanceof ConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error('API request failed', error instanceof Error ? error.message : 'unknown error');
  return NextResponse.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500 });
}
