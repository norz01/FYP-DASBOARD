import LoginForm from '@/components/auth/LoginForm';

// Paksa dinamik supaya tidak cuba baca cookie semasa build
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Log Masuk | TVETMARA Besut',
};

// JANGAN baca cookie di sini. Middleware sudah uruskan redirect.
export default function LoginPage() {
  return <LoginForm />;
}