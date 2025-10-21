import request from 'supertest';
import app from '../../src/app';

describe('Health API', () => {
  test('GET /api/health should return healthy status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.timestamp).toBeDefined();
    expect(response.body.data.uptime).toBeDefined();
  });
});
