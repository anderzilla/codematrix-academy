import { NextResponse } from 'next/server';
import { listPublishedCourses } from '@/lib/catalog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') ?? undefined;
  const courses = listPublishedCourses(query);
  return NextResponse.json({
    ok: true,
    count: courses.length,
    courses,
  });
}
