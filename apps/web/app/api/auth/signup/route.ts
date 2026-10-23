import { NextResponse } from 'next/server';
import { beginOAuth } from '../../../../lib/begin-oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return beginOAuth('signup');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Account creation is not configured' }, { status: 503 });
  }
}
