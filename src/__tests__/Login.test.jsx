import '@testing-library/jest-dom'; // WAJIB ADA - ini menyediakan toBeInTheDocument()
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginForm from '@/components/auth/LoginForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/script', () => ({
  default: () => null,
}));

vi.mock('@/app/actions', () => ({
  loginAction: vi.fn(),
}));

describe('LoginForm Component (SSR)', () => {
  it('renders the login heading and form inputs successfully', () => {
    render(<LoginForm />);
    
    expect(screen.getByText(/Selamat Kembali/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Emel Pengguna/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kata Laluan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Masuk Dashboard/i })).toBeInTheDocument();
  });
});