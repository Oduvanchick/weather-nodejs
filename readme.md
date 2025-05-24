# 🌤️ Weather Subscription API

A Node.js REST API that allows users to:
- Get current weather by city
- Subscribe to weather updates
- Confirm their subscription
- Unsubscribe via a confirmation token

---

## 📦 Tech Stack

- **Node.js + Express**
- **PostgreSQL**
- **Docker + Docker Compose**
- **Nodemailer** (optional for sending emails)
- **node-pg-migrate** (for database migrations)
- **Jest + Supertest** (for functional tests)

---

## 🚀 Getting Started

### 1. Prerequisites

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- (Optional) Node.js + npm (for non-docker usage)

---

### 2. Clone the Repository

```bash
git clone https://github.com/Oduvanchick/weather-api-app.git
cd weather-api-app
```

---

### 3. Create `.env` File

Create a `.env` file with the following contents:

```env
# App
PORT=3000
BASE_URL=http://localhost:3000

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DATABASE=postgres

# Weather API
WEATHER_API_KEY=your_weatherapi_key

# Email (for Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

### 4. Run with Docker

```bash
docker-compose up --build
```

This will:
- Start PostgreSQL and the Node.js app
- Run DB migrations
- Start listening on `http://localhost:3000`

---

## 🌐 API Endpoints

### ✅ Get Weather
```
GET /api/weather?city=Kyiv
```

### 📩 Subscribe
```
POST /api/subscribe?email=test@example.com&city=Kyiv&frequency=hourly
```

### 📬 Confirm
```
GET /api/confirm/:token
```

### ❌ Unsubscribe
```
GET /api/unsubscribe/:token
```

---

## 🧪 Running Tests

```bash
docker-compose exec app npm test
```

> Tests use Jest + Supertest to cover:
> - Weather lookups
> - Confirmation & unsubscription flow

---

## ⚙️ Migrations

To apply migrations manually:

```bash
docker-compose exec app npm run migrate
```

SQL-based migrations are stored in `/migrations`.
