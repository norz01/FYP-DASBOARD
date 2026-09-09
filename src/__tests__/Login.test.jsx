import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginForm from '../components/auth/LoginForm';

// Mock Next.js modules untuk halang error semasa test
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/script', () => ({
  default: () => null,
}));

// Mock Server Actions
vi.mock('../app/actions', () => ({
  loginAction: vi.fn(),
}));

describe('LoginForm Component (SSR)', () => {
  it('renders the login heading and form inputs successfully', () => {
    render(<LoginForm />);
    
    // Semak jika UI utama berjaya dipaparkan
    expect(screen.getByText(/Selamat Kembali/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Emel Pengguna/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kata Laluan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Masuk Dashboard/i })).toBeInTheDocument();
  });
});