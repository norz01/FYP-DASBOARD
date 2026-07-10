import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { vi } from 'vitest';
import '@testing-library/jest-dom'; // 👈 Add this for custom matchers

// Mock the navigate function
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    mockNavigate.mockClear();
  });

  it('renders login form correctly', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('Selamat Kembali')).toBeInTheDocument();
  });

  it('shows error on failed login', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Login gagal.' }),
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Use getByDisplayValue since the inputs are pre-filled
    fireEvent.change(screen.getByDisplayValue('admin@ikmb.edu.my'), { target: { value: 'wrong@test.com' } });
    fireEvent.change(screen.getByDisplayValue('password123'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Log Masuk Dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Login gagal.')).toBeInTheDocument();
    });
  });
});