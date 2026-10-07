import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveAuthUser } from '@/lib/auth';
import { getClassesOverview } from '@/app/(protected)/kelas/queries';

/**
 * GET /api/kelas/classes
 *
 * Lightweight JSON endpoint used by the "Muat Lebih Banyak" button in
 * ClassManagementView to fetch the next page of classes without a full
 * page navigation. Accepts the same query params as the main kelas page:
 *   ?role=manage&page=2&search=...&generationId=...&tierLevel=...&academicYear=...
 *
 * Returns ClassesOverviewData serialised as JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const { authUser, dbUser } = await getEffectiveAuthUser();

    if (!authUser || !dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse search params from the request URL
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const data = await getClassesOverview(dbUser.id, params);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[GET /api/kelas/classes] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
