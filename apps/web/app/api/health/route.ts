export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ status: 'ok', service: 'wanderwrap-web', architecture: 'omnichannel-bff-v1' });
}
