# Logistic Standalone

Standalone logistics app: create orders (route, vehicle, driver, sales, DCs, retailers, items or auto-allocate) and view branches and shipments on a full-screen map.

## Stack

- **Backend:** Node.js, Express, MySQL (mysql2)
- **Frontend:** React, Vite, React Router, Leaflet (react-leaflet)
- **Database:** MySQL (create DB and tables via schema + seed)

## Setup

### 1. Database

Create the database and tables, then seed sample data (Manu, DC, 2 retailers, 1 route, 2 cars, 4 employees, 2 products).

**Bash / Cmd (Linux, macOS, or Windows Cmd):**

```bash
# From logistic-standalone folder
mysql -u root -p < server/db/schema.sql
mysql -u root -p logistic_standalone < server/db/seed.sql
```

**PowerShell (Windows):**  
PowerShell reserves `<`, so use one of these:

```powershell
# Option A: run via Cmd
cmd /c "mysql -u root -p < server/db/schema.sql"
cmd /c "mysql -u root -p logistic_standalone < server/db/seed.sql"

# Option B: pipe file content (you will be prompted for password)
Get-Content server/db/schema.sql -Raw | mysql -u root -p
Get-Content server/db/seed.sql -Raw | mysql -u root -p logistic_standalone

# Option C: from MySQL shell (mysql -u root -p, then):
source server/db/schema.sql
use logistic_standalone;
source server/db/seed.sql
```

### 2. Environment

Copy `.env.example` to `.env` and set your MySQL credentials and port:

```bash
cp .env.example .env
# Edit .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT (default 3002)
```

### 3. Install and run

```bash
cd logistic-standalone
npm install
```

Run the API server (default port 3002):

```bash
npm run server
```

In another terminal, run the frontend (Vite dev server, port 5174):

```bash
npm run dev
```

Open [http://localhost:5174](http://localhost:5174).

## Usage

1. **Create Order** (step-by-step):
   - **Route:** Select a route.
   - **Vehicle & Crew:** Select car, driver, and sales (Buddy System: driver and sales must be different).
   - **DCs:** Select which distribution centers on the route to use.
   - **Retailers:** Select sub-branches (retailers) under each selected DC.
   - **Items:** Enter quantities per product per retailer, or click **Auto-allocate** to fill suggested quantities.
   - **Submit:** Create shipment; you are redirected to the map.

2. **Map:** Full-screen map showing all branches (markers) and active shipments (polylines + car marker). Data comes from `GET /api/map/branches` and `GET /api/map/by-car`.

## API (summary)

| Method + Path | Description |
|---------------|-------------|
| GET /api/routes | List routes |
| GET /api/route-stops/:routeId | Stops for a route (branch + cat_id) |
| GET /api/cars | Cars (?available=1, ?type=...) |
| GET /api/employees | Employees (?job_title=Driver\|Sales) |
| GET /api/products | Products |
| GET /api/branch-categories | Branch categories |
| GET /api/branches/:branchId/retailers | Retailers under a DC |
| POST /api/allocations/calculate | Auto-allocation (branch_ids, product_ids?, car_capacity_m3?) |
| POST /api/shipments | Create shipment + orders + order_items (+ dc_assignments) |
| GET /api/map/branches | Branches with lat/lng |
| GET /api/map/by-car | Cars with orders/stops for map |

## Scripts

- `npm run dev` — Start Vite dev server (frontend)
- `npm run server` — Start Express API server
- `npm run build` — Build frontend for production
- `npm run preview` — Preview production build
