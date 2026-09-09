import Script from 'next/script';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'TVETMARA Besut - Papan Pemuka Pintar',
  description: 'Skills & Talent Development Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ms">
      <body className={plusJakartaSans.className}>
        {/* Muatkan Phosphor Icons (menggantikan link dalam index.html lama) */}
        <Script src="https://unpkg.com/@phosphor-icons/web" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}