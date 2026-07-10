import request from 'supertest';
import app from '../server.js';
import { authenticateUser } from '../auth.model.js';

// Mock the auth.model.js functions
jest.mock('../auth.model.js', () => ({
  authenticateUser: jest.fn(),
  getPublicLoginUsers: jest.fn()
}));

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    // Clear mock history before each test
    authenticateUser.mockClear();
  });

  it('should login successfully with valid admin credentials', async () => {
    // Mock the database to return a successful login
    authenticateUser.mockResolvedValueOnce({
      user: { email: 'admin@ikmb.edu.my', role: 'admin', displayName: 'Admin IKMB' },
      token: 'fake-jwt-token-123'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ikmb.edu.my', password: 'password123' });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
  });

  it('should fail login with wrong password', async () => {
    // Mock the database to return null (invalid credentials)
    authenticateUser.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ikmb.edu.my', password: 'wrongpassword' });
    
    expect(res.statusCode).toEqual(401);
  });
});