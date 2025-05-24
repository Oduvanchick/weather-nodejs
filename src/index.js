require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const PORT = process.env.PORT || 3000;
const cron = require('node-cron');

const app = express();

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false, // Render's PostgreSQL requires SSL
            },
        }
        : {
            host: process.env.POSTGRES_HOST,
            port: process.env.POSTGRES_PORT,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DATABASE,
        }
);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

module.exports = pool;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;


app.get('/api/weather', async (req, res) => {
    const { city } = req.query;

    // Validate input
    if (!city) return res.status(400).json({ error: 'City is required' });

    try {
        // Get weather
        const weather = await getWeather(city);
        const { temp_c, humidity, condition } = weather;
        res.status(200).json({
            temperature: temp_c,
            humidity,
            description: condition.text
        });
    } catch (err) {
        res.status(404).json({ error: 'City not found' });
    }
});


app.post('/api/subscribe', async (req, res) => {
    const { email, city, frequency } = req.query;

    // Validate input
    if (!email || !city || !['daily', 'hourly'].includes(frequency)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const valid = await isValidCity(city);
    if (!valid) {
        return res.status(400).json({ error: 'Invalid input: city not found' });
    }

    try {
        // Check for existing subscription
        const existing = await pool.query(
            'SELECT * FROM subscriptions WHERE email = $1 AND city = $2',
            [email, city]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already subscribed' });
        }

        // Insert new subscription
        const token = uuidv4();
        await pool.query(
            'INSERT INTO subscriptions(email, city, frequency, confirmed, token) VALUES ($1, $2, $3, $4, $5)',
            [email, city, frequency, false, token]
        );

        // Sending confirmation email
        if (process.env.NODE_ENV !== 'test') {
            const confirmLink = `${process.env.BASE_URL || 'http://localhost:3000'}/api/confirm/${token}`;
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: email,
                subject: 'Confirm your weather subscription',
                html: `<p>Click <a href="${confirmLink}">here</a> to confirm your subscription.</p>`
            });
        }

        return res.status(200).json({ message: 'Confirmation email sent.' });

    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/api/confirm/:token', async (req, res) => {
    const { token } = req.params;

    // Check for existing subscription with token
    const result = await pool.query('SELECT * FROM subscriptions WHERE token = $1', [token]);
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Token not found' });
    }

    const { email, city } = result.rows[0];

    // Add confirmation token
    await pool.query('UPDATE subscriptions SET confirmed = true WHERE token = $1', [token]);

    try {
        if (process.env.NODE_ENV !== 'test') {
            await sendWeatherEmail(email, city);
        }

        res.status(200).json({ message: 'Subscription confirmed successfully' });
    } catch (err) {
        res.status(200).json({ message: 'Confirmed, but failed to send forecast.' });
    }
});


app.get('/api/unsubscribe/:token', async (req, res) => {
    const { token } = req.params;

    // Check for existing subscription with token
    const result = await pool.query('SELECT * FROM subscriptions WHERE token = $1', [token]);
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Token not found' });
    }

    // Delete token
    await pool.query('DELETE FROM subscriptions WHERE token = $1', [token]);
    res.status(200).json({ message: 'Unsubscribed successfully' });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Weather API running on http://localhost:${PORT}`);
    });
}

async function isValidCity(city) {
    try {
        await getWeather(city);
        return true;
    } catch {
        return false;
    }
}

async function getWeather(city) {
    const response = await axios.get(`http://api.weatherapi.com/v1/current.json`, {
        params: {
            key: WEATHER_API_KEY,
            q: city
        }
    });
    return response.data.current;
}

// Common function to send emails
async function sendWeatherEmails(subscribers) {
    for (const sub of subscribers) {
        try {

            await sendWeatherEmail(sub.email, sub.city);

            console.log(`Email sent to ${sub.email} for ${sub.city}`);
        } catch (err) {
            console.error(`Failed to send email to ${sub.email}:`, err.message);
        }
    }
}

// Common function to send email
async function sendWeatherEmail(email, city) {
    const weather = await getWeather(city);
    const { temp_c, humidity, condition } = weather;
    const message = `
Weather in ${city}:
🌡️ Temp: ${temp_c}°C
💧 Humidity: ${humidity}%
☁️ Condition: ${condition.text}
            `;

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: `⛅ Weather Update for ${city}`,
        text: message
    });
}


if (process.env.NODE_ENV !== 'test') {
    // HOURLY: runs every hour at minute 0 (e.g., 12:00, 13:00, etc.)
    cron.schedule('0 * * * *', async () => {
        console.log('Running hourly weather update...');
        const res = await pool.query('SELECT * FROM subscriptions WHERE confirmed = true AND frequency = $1', ['hourly']);
        await sendWeatherEmails(res.rows);
    });

    // DAILY: runs every day at 08:00 AM server time
    cron.schedule('0 8 * * *', async () => {
        console.log('Running daily weather update...');
        const res = await pool.query('SELECT * FROM subscriptions WHERE confirmed = true AND frequency = $1', ['daily']);
        await sendWeatherEmails(res.rows);
    });
}

module.exports = { app, pool };