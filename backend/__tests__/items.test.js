import request from 'supertest';
import app from '../server.js';

describe('Student API Security', () => {
  it('should block access to /api/students without a token', async () => {
    const res = await request(app).get('/api/students');
    expect(res.statusCode).toEqual(403); // Forbidden
  });

  it('should block access with an invalid token', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', 'Bearer invalidtoken123');
    
    expect(res.statusCode).toEqual(401); // Unauthorized
  });
});