import { jest } from '@jest/globals';
import request from 'supertest';

// 1. Setup the ESM mock FIRST
jest.unstable_mockModule('../auth.model.js', () => ({
  authenticateUser: jest.fn(),
  getPublicLoginUsers: jest.fn(),
  changeOwnPassword: jest.fn(),
  adminResetPassword: jest.fn(),
  verifyStudentIdentity: jest.fn(),
  createPasswordResetToken: jest.fn(),
  resetPasswordWithToken: jest.fn(),
}));

// 2. Dynamically import the app and mocked module AFTER the mock is declared
const { default: app } = await import('../server.js');
const { authenticateUser, changeOwnPassword } = await import('../auth.model.js');

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    authenticateUser.mockClear();
    changeOwnPassword.mockClear();
  });

  it('should login successfully with valid admin credentials', async () => {
    authenticateUser.mockResolvedValueOnce({
      user: { email: 'admin@ikmb.edu.my', role: 'admin', displayName: 'Admin IKMB' },
      token: 'fake-jwt-token-123',
      mustChangePassword: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ikmb.edu.my', password: 'password123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.mustChangePassword).toBe(false);
  });

  it('should fail login with wrong password', async () => {
    authenticateUser.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ikmb.edu.my', password: 'wrongpassword' });

    expect(res.statusCode).toEqual(401);
  });

  it('should surface the mustChangePassword flag for flagged students', async () => {
    authenticateUser.mockResolvedValueOnce({
      user: { email: '333571247823@student.ikmb.edu.my', role: 'user', displayName: 'S', studentId: '333571247823' },
      token: 'fake-jwt-token-456',
      mustChangePassword: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '333571247823@student.ikmb.edu.my', password: 'password123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('should return 423 when the account is locked', async () => {
    authenticateUser.mockRejectedValueOnce(
      Object.assign(new Error('Akaun dikunci sementara. Cuba lagi dalam 15 minit.'), { status: 423 })
    );

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'locked@student.ikmb.edu.my', password: 'whatever1' });

    expect(res.statusCode).toEqual(423);
    expect(res.body.message).toMatch(/dikunci/);
  });
});