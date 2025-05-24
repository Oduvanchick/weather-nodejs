const request = require('supertest');
const { app, pool } = require('../src/index');


describe('Weather API', () => {
    test('GET /api/weather with valid city returns data', async () => {
        const res = await request(app).get('/api/weather?city=Kyiv');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('temperature');
        expect(res.body).toHaveProperty('humidity');
        expect(res.body).toHaveProperty('description');
    });

    test('GET /api/weather without city returns 400', async () => {
        const res = await request(app).get('/api/weather');
        expect(res.statusCode).toBe(400);
    });
});

describe('Subscription flow', () => {
    const email = `test_${Date.now()}@example.com`;
    const city = 'Kyiv';
    const frequency = 'hourly';

    let token;

    test('POST /api/subscribe stores token in DB', async () => {
        const res = await request(app).post('/api/subscribe')
            .query({ email, city, frequency });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/Confirmation email sent/);

        // Get the token from the DB
        const dbRes = await pool.query(
            'SELECT token FROM subscriptions WHERE email = $1 AND city = $2',
            [email, city]
        );

        expect(dbRes.rows.length).toBe(1);
        token = dbRes.rows[0].token;
        expect(token).toBeDefined();
    });

    test('GET /api/confirm/:token confirms subscription', async () => {
        const res = await request(app).get(`/api/confirm/${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/confirmed/i);
    });

    test('GET /api/unsubscribe/:token deletes subscription', async () => {
        const res = await request(app).get(`/api/unsubscribe/${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/unsubscribed/i);
    });

    test('GET /api/unsubscribe/:token again returns 404', async () => {
        const res = await request(app).get(`/api/unsubscribe/${token}`);
        expect(res.statusCode).toBe(404);
    });
});

afterAll(async () => {
    await pool.end();
    jest.clearAllMocks();
});