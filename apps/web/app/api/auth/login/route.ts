import { NextResponse } from 'next/server';
import { beginOAuth } from '../../../../lib/begin-oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return beginOAuth('login');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication is not configured' }, { status: 503 });
  }
}
