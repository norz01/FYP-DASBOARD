import StudentProfileClient from '@/components/dashboard/StudentProfileClient';
export const dynamic = 'force-dynamic';
export default async function StudentProfilePage({ searchParams }) {
  const params = await searchParams;
  const studentId = params?.id || 'TVET001';
  const dataset = params?.dataset || null;
  const returnTab = params?.from || null;
  return <StudentProfileClient studentId={studentId} dataset={dataset} returnTab={returnTab} />;
}
