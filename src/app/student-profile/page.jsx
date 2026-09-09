import StudentProfileClient from '@/components/dashboard/StudentProfileClient';
export const dynamic = 'force-dynamic';
export default async function StudentProfilePage({ searchParams }) {
  const params = await searchParams;
  const studentId = params?.id || 'TVET001';
  return <StudentProfileClient studentId={studentId} />;
}
