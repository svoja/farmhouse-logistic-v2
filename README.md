# Bread Logistics OS (React)

React + Tailwind + Vite + Express + MySQL logistics application.

## Environment Setup

### 1. Database

Ensure MySQL/MariaDB is running and create the database:

```sql
CREATE DATABASE bread_logistics;
```

Copy schema from `d:\logistic_OS\new_schema.sql` if migrating from the old project.

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set your database credentials:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | API server port | 3000 |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | (empty) |
| DB_NAME | Database name | bread_logistics |
| VITE_API_URL | API base URL (production) | (empty = same origin) |

## Run

**Development** (two terminals):

```bash
# Terminal 1: API server (port 3000)
npm run server

# Terminal 2: React dev server (port 5173)
npm run dev
```

Then open http://localhost:5173

**Production build:**

```bash
npm run build
NODE_ENV=production npm run server
```

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4
- **Backend:** Express 5, MySQL2
- **Database:** MySQL/MariaDB (`bread_logistics`)
