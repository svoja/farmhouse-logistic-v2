import 'dotenv/config';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

import express from 'express';
import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bread_logistics',
  connectTimeout: 10000,
};

// V2 schema (bread_logistics_v2) for Create Shipment Plan
const dbConfigV2 = {
  ...dbConfig,
  database: process.env.DB_NAME_V2 || 'bread_logistics_v2',
};

// Connection pools to avoid "too many connections" (reuse connections, no strict limit)
const poolConfig = { ...dbConfig, queueLimit: 0 };
const poolConfigV2 = { ...dbConfigV2, queueLimit: 0 };
const pool = mysql.createPool(poolConfig);
const poolV2 = mysql.createPool(poolConfigV2);
// Prevent pool errors (e.g. connection refused) from crashing the process
pool.on('error', (err) => console.error('DB pool error:', err.message || err));
poolV2.on('error', (err) => console.error('DB poolV2 error:', err.message || err));

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.0.1' });
});

// Frontend config (e.g. Google Maps API key — restrict by referrer in Google Cloud)
app.get('/api/config', (_req, res) => {
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// API status for AI page: DB + OpenClaw gateway
app.get('/api/ai-status', (req, res) => {
  const result = { database: 'unknown', ai_model: 'openclaw:main', gateway: 'unknown' };
  function send() {
    res.json(result);
  }
  pool
    .getConnection()
    .then((conn) => conn.execute('SELECT 1').then(() => conn.release()))
    .then(() => {
      result.database = 'connected';
    })
    .catch((err) => {
      result.database = 'disconnected';
      result.database_error = err.message || 'Connection failed';
    })
    .then(() => {
      result.ai_model = 'openclaw:main';
      const gatewayPromise = new Promise((resolve) => {
        try {
          const u = new URL(OPENCLAW_URL);
          const mod = u.protocol === 'https:' ? https : http;
          const req = mod.get(OPENCLAW_URL, (r) => {
            resolve(r.statusCode && r.statusCode < 500 ? 'reachable' : 'unreachable');
          });
          req.on('error', () => resolve('unreachable'));
          req.setTimeout(3000, () => {
            req.destroy();
            resolve('unreachable');
          });
        } catch (_) {
          resolve('unreachable');
        }
      });
      return gatewayPromise.then((g) => {
        result.gateway = g;
        send();
      });
    })
    .catch(() => {
      send();
    });
});

// GET /api/routes - List routes. Optional ?routes_type=1 for main routes only
app.get('/api/routes', async (req, res) => {
  try {
    const routesType = req.query.routes_type != null ? parseInt(req.query.routes_type, 10) : null
    const conn = await pool.getConnection()
    let sql = 'SELECT routes_id, routes_name, routes_description, routes_type FROM routes'
    const params = []
    if (!isNaN(routesType)) {
      sql += ' WHERE routes_type = ?'
      params.push(routesType)
    }
    sql += ' ORDER BY routes_name'
    const [rows] = await conn.execute(sql, params)
    await conn.release()
    const list = (rows || []).map((r) => ({
      routes_id: r.routes_id ?? r.routesId,
      routes_name: r.routes_name ?? r.routesName ?? '',
      routes_description: r.routes_description ?? r.routesDescription ?? null,
      routes_type: r.routes_type ?? r.routesType ?? null,
    }))
    res.json(list)
  } catch (err) {
    console.error('Routes API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/employees - List employees by role. ?job_description_id=1 driver, 2 sales
app.get('/api/employees', async (req, res) => {
  const jobId = req.query.job_description_id != null ? parseInt(req.query.job_description_id, 10) : 1
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(
      `SELECT employees_id, emp_firstname, emp_lastname, job_description_id,
        CONCAT(emp_firstname, ' ', emp_lastname) AS full_name
       FROM employees WHERE job_description_id = ?
       ORDER BY emp_firstname, emp_lastname`,
      [isNaN(jobId) ? 1 : jobId]
    )
    await conn.release()
    res.json(rows || [])
  } catch (err) {
    console.error('Employees API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/routes/:routes_id/branches - Route-branches for selected route
app.get('/api/routes/:routes_id/branches', async (req, res) => {
  const routesId = parseInt(req.params.routes_id, 10)
  if (isNaN(routesId)) return res.status(400).json({ error: 'Invalid routes_id' })
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(
      `SELECT rb.routebranch_id, rb.routes_id, rb.branch_id, rb.stop_sequence,
        b.branch_name, b.branch_category_id, r.routes_name,
        CONCAT(r.routes_name, ' - ', b.branch_name) AS label
       FROM routes_and_branch rb
       JOIN routes r ON rb.routes_id = r.routes_id
       JOIN branch b ON rb.branch_id = b.branch_id
       WHERE rb.routes_id = ?
       ORDER BY rb.stop_sequence, b.branch_name`,
      [routesId]
    )
    await conn.release()
    res.json(rows || [])
  } catch (err) {
    console.error('Route branches API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/branches/:branch_id/local-branches - Find sub-branches from local routes (type 2) for a distributor
app.get('/api/branches/:branch_id/local-branches', async (req, res) => {
  const branchId = parseInt(req.params.branch_id, 10)
  if (isNaN(branchId)) return res.status(400).json({ error: 'Invalid branch_id' })
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(
      `SELECT rb.routebranch_id, rb.routes_id, rb.branch_id, rb.stop_sequence,
        b.branch_name, b.branch_category_id, r.routes_name
       FROM routes_and_branch rb
       JOIN routes r ON rb.routes_id = r.routes_id
       JOIN branch b ON rb.branch_id = b.branch_id
       WHERE r.routes_type = 2
         AND rb.routes_id IN (
           SELECT rb2.routes_id FROM routes_and_branch rb2 WHERE rb2.branch_id = ?
         )
         AND rb.branch_id != ?
       ORDER BY rb.stop_sequence`,
      [branchId, branchId]
    )
    await conn.release()
    res.json(rows || [])
  } catch (err) {
    console.error('Local branches API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/box-sizes - List box sizes for packing calculation
app.get('/api/box-sizes', async (_req, res) => {
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(
      `SELECT box_size_id, box_size_name, box_size_width, box_size_length, box_size_high FROM box_size ORDER BY box_size_id`
    )
    await conn.release()
    res.json((rows || []).map((r) => ({
      box_size_id: r.box_size_id,
      box_size_name: r.box_size_name ?? '',
      box_size_width: parseFloat(r.box_size_width) || 0,
      box_size_length: parseFloat(r.box_size_length) || 0,
      box_size_high: parseFloat(r.box_size_high) || 0,
    })))
  } catch (err) {
    console.error('Box sizes API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/lots - List lots for selector. ?product_id=X & ?latest=1 for newest only
app.get('/api/lots', async (req, res) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id, 10) : null
    const latestOnly = req.query.latest === '1' || req.query.latest === 'true'
    const conn = await pool.getConnection()
    let sql = `
      SELECT ld.lot_id, ld.lot_code, ld.product_id, ld.description, ld.manufacturing_date, ld.expired_date, ld.created_at,
        p.product_name
      FROM lot_definitions ld
      JOIN product p ON ld.product_id = p.product_id
    `
    const params = []
    if (!isNaN(productId) && productId > 0) {
      sql += ' WHERE ld.product_id = ?'
      params.push(productId)
    }
    sql += ' ORDER BY ld.manufacturing_date DESC, ld.created_at DESC'
    if (latestOnly) sql += ' LIMIT 1'
    const [rows] = await conn.execute(sql, params)
    await conn.release()
    res.json(rows || [])
  } catch (err) {
    console.error('Lots API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/inventory-stocks - Stock at factory (inventory_stocks). ?location_id=7 for specific factory
app.get('/api/inventory-stocks', async (req, res) => {
  try {
    const locationId = req.query.location_id ? parseInt(req.query.location_id, 10) : null
    const conn = await pool.getConnection()
    let sql = `
      SELECT inv.stock_id, inv.lot_id, inv.location_id, inv.quantity, inv.status, inv.last_updated,
        ld.lot_code, ld.product_id, ld.manufacturing_date, ld.expired_date,
        p.product_name, b.branch_name
      FROM inventory_stocks inv
      JOIN lot_definitions ld ON inv.lot_id = ld.lot_id
      JOIN product p ON ld.product_id = p.product_id
      JOIN branch b ON inv.location_id = b.branch_id
      WHERE inv.status IN ('Available', 'Reserved')
    `
    const params = []
    if (!isNaN(locationId) && locationId > 0) {
      sql += ' AND inv.location_id = ?'
      params.push(locationId)
    }
    sql += ' ORDER BY inv.location_id, ld.product_id, ld.manufacturing_date'
    const [rows] = await conn.execute(sql, params)
    await conn.release()
    const list = (rows || []).map((r) => ({
      stock_id: r.stock_id,
      lot_id: r.lot_id,
      lot_code: r.lot_code,
      location_id: r.location_id,
      branch_name: r.branch_name,
      product_id: r.product_id,
      product_name: r.product_name,
      quantity: r.quantity,
      status: r.status,
      manufacturing_date: r.manufacturing_date,
      expired_date: r.expired_date,
    }))
    res.json(list)
  } catch (err) {
    console.error('Inventory stocks API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/products - List products for create order
app.get('/api/products', async (_req, res) => {
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(
      `SELECT product_id, product_name, unit_price,
        product_size_width, product_size_length, product_size_high
       FROM product ORDER BY product_name`
    )
    await conn.release()
    const products = (rows || []).map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name ?? '',
      unit_price: parseFloat(r.unit_price) || 0,
      product_size_width: r.product_size_width,
      product_size_length: r.product_size_length,
      product_size_high: r.product_size_high,
    }))
    res.json(products)
  } catch (err) {
    console.error('Products API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/branches/insights?branch_ids=1,2,3 - Customer insight, peak time, product insight per branch
app.get('/api/branches/insights', async (req, res) => {
  const idsParam = req.query.branch_ids
  if (!idsParam || typeof idsParam !== 'string') return res.json({})
  const branchIds = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  if (branchIds.length === 0) return res.json({})
  const placeholders = branchIds.map(() => '?').join(',')
  try {
    const conn = await pool.getConnection()
    const [customerRows] = await conn.execute(
      `SELECT branch_id, customer_type, description FROM branch_customer_insight WHERE branch_id IN (${placeholders})`,
      branchIds
    )
    const [peakRows] = await conn.execute(
      `SELECT branch_id, start_time, end_time, note FROM branch_peak_time WHERE branch_id IN (${placeholders})`,
      branchIds
    )
    const [productRows] = await conn.execute(
      `SELECT branch_id, product_name, note FROM branch_product_insight WHERE branch_id IN (${placeholders})`,
      branchIds
    )
    await conn.release()
    const result = {}
    for (const id of branchIds) result[id] = { customer: [], peak_time: [], product: [] }
    for (const r of customerRows || []) {
      const id = r.branch_id
      if (!result[id]) result[id] = { customer: [], peak_time: [], product: [] }
      result[id].customer.push({ customer_type: r.customer_type, description: r.description })
    }
    for (const r of peakRows || []) {
      const id = r.branch_id
      if (!result[id]) result[id] = { customer: [], peak_time: [], product: [] }
      result[id].peak_time.push({ start_time: r.start_time, end_time: r.end_time, note: r.note })
    }
    for (const r of productRows || []) {
      const id = r.branch_id
      if (!result[id]) result[id] = { customer: [], peak_time: [], product: [] }
      result[id].product.push({ product_name: r.product_name, note: r.note })
    }
    res.json(result)
  } catch (err) {
    console.error('Branch insights API error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/branches - Branches with lat/long for map (legacy route-radar). Tries v2 first, then old schema.
app.get('/api/branches', async (_req, res) => {
  const toLegacyShape = (rows, nameKey, latKey, lngKey) =>
    (rows || []).map((r) => ({
      branch_id: r.branch_id,
      branch_name: r[nameKey] ?? '',
      branch_latitude: parseFloat(r[latKey]),
      branch_longitude: parseFloat(r[lngKey]),
    }));

  try {
    // 1) Try v2 (bread_logistics_v2) — branch has name, latitude, longitude
    try {
      const connV2 = await getV2Conn();
      const [rowsV2] = await connV2.execute(
        'SELECT branch_id, name, latitude, longitude FROM branch WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY branch_id'
      );
      await connV2.release();
      if (rowsV2 && rowsV2.length > 0) {
        return res.json(toLegacyShape(rowsV2, 'name', 'latitude', 'longitude'));
      }
    } catch (e1) {
      if (process.env.NODE_ENV !== 'production') console.error('Branches v2 fallback:', e1?.message || e1);
    }

    // 2) Fallback: dbConfig — try v2-style columns first, then old schema columns
    let conn;
    try {
      conn = await pool.getConnection();
    } catch (eConn) {
      console.error('Branches API: DB connection failed:', eConn?.message || eConn);
      return res.json([]);
    }
    try {
      const [rows] = await conn.execute(
        'SELECT branch_id, name AS branch_name, latitude AS branch_latitude, longitude AS branch_longitude FROM branch WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY branch_id'
      );
      await conn.release();
      return res.json(rows || []);
    } catch (_) {
      try {
        const [rowsOld] = await conn.execute(
          'SELECT branch_id, branch_name, branch_latitude, branch_longitude FROM branch WHERE branch_latitude IS NOT NULL AND branch_longitude IS NOT NULL ORDER BY branch_id'
        );
        await conn.release();
        return res.json(rowsOld || []);
      } catch (e2) {
        await conn.release().catch(() => {});
        console.error('Branches API fallback error:', e2?.message || e2);
        return res.json([]);
      }
    }
  } catch (err) {
    console.error('Branches API error:', err);
    res.json([]);
  }
});

// GET /api/orders/by-car - Legacy route-radar: cars + orders from v2 only (PLANNING, LOADING, IN_TRANSIT).
app.get('/api/orders/by-car', async (_req, res) => {
  return byCarFromV2(res);
});

/** cat_id: 1 = โรงงาน/Factory, 2 = ศูนย์กระจาย/DC, 3 = ร้าน/Retailer */
const FACTORY_CAT_ID = 1;
const DC_CAT_ID = 2;

/** Legacy by-car shape from v2. รถใหญ่: Factory → DC → กลับ Factory. รถเล็ก: รอที่ DC → ไปส่งร้าน. */
async function byCarFromV2(res) {
  try {
    const conn = await getV2Conn();
    const [shipRows] = await conn.execute(
      `SELECT s.shipment_id, s.car_id, s.route_id, s.status AS shipment_status,
        c.license_plate, t.name AS cars_type_name,
        CONCAT(e.firstname, ' ', e.lastname) AS driver_name
       FROM shipments s
       JOIN cars c ON s.car_id = c.car_id
       LEFT JOIN car_type t ON c.type_id = t.type_id
       JOIN employees e ON s.driver_emp_id = e.emp_id
       WHERE s.status IN ('PLANNING', 'LOADING', 'IN_TRANSIT')
       ORDER BY s.shipment_id`
    );
    const cars = [];
    for (const ship of shipRows || []) {
      // รถใหญ่: วิ่งเฉพาะ โรงงาน → ศูนย์กระจาย (DC) → กลับโรงงาน (ไม่ไปร้าน Top daily)
      let orders = [];
      if (ship.route_id) {
        const [stopRows] = await conn.execute(
          `SELECT rs.branch_id, rs.stop_sequence, b.name AS branch_name, b.latitude, b.longitude, b.cat_id
           FROM route_stops rs
           JOIN branch b ON rs.branch_id = b.branch_id
           WHERE rs.route_id = ? AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND b.cat_id IN (?, ?)
           ORDER BY rs.stop_sequence`,
          [ship.route_id, FACTORY_CAT_ID, DC_CAT_ID]
        );
        const factoryRow = (stopRows || []).find((r) => r.cat_id === FACTORY_CAT_ID);
        const dcRows = (stopRows || []).filter((r) => r.cat_id === DC_CAT_ID).sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
        const toOrder = (r, name) => ({
          order_id: 0,
          car_id: ship.car_id,
          delivery_status: 'pending',
          branch_id: r.branch_id,
          branch_name: (r.branch_name ?? name) || '',
          branch_latitude: parseFloat(r.latitude),
          branch_longitude: parseFloat(r.longitude),
          route_routes_type: null,
          driver_name: ship.driver_name ?? '',
        });
        // รถใหญ่ต้องเริ่มที่โรงงานเสมอ: Factory → DC(s) → กลับโรงงาน
        if (factoryRow) {
          orders.push(toOrder(factoryRow, 'Factory'));
          for (const dc of dcRows) orders.push(toOrder(dc, 'DC'));
          if (dcRows.length > 0) orders.push(toOrder(factoryRow, 'Factory')); // กลับโรงงาน
        } else if (dcRows.length > 0) {
          // route ไม่มี Factory ใน route_stops — หาโรงงานจาก branch แล้วใส่ข้างหน้า
          const [[fb]] = await conn.execute(
            `SELECT branch_id, name, latitude, longitude FROM branch WHERE (cat_id = ? OR LOWER(name) LIKE '%factory%') AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 1`,
            [FACTORY_CAT_ID]
          );
          if (fb) {
            orders.push({ order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: fb.name ?? 'Factory', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), route_routes_type: null, driver_name: ship.driver_name ?? '' });
            for (const dc of dcRows) orders.push(toOrder(dc, 'DC'));
            orders.push({ order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: (fb.name ?? 'Factory') + ' (กลับ)', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), route_routes_type: null, driver_name: ship.driver_name ?? '' });
          }
        }
      }
      if (orders.length === 0) {
        const [[fb]] = await conn.execute(
          `SELECT branch_id, name, latitude, longitude FROM branch WHERE (cat_id = ? OR LOWER(name) LIKE '%factory%') AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 1`,
          [FACTORY_CAT_ID]
        );
        if (fb) {
          const f = { order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: fb.name ?? 'Factory', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), route_routes_type: null, driver_name: ship.driver_name ?? '' };
          orders = [f, f];
        }
      }
      // So legacy radar shows car "running": when IN_TRANSIT, set first non-delivered to in_transit
      if (String(ship.shipment_status) === 'IN_TRANSIT' && orders.length > 0) {
        const idx = orders.findIndex((o) => o.delivery_status !== 'delivered');
        if (idx >= 0) {
          orders = orders.map((o, i) => (i === idx ? { ...o, delivery_status: 'in_transit' } : o));
        }
      }
      if (orders.length > 0) {
        cars.push({
          shipment_id: ship.shipment_id,
          car_id: ship.car_id,
          license_plate: ship.license_plate ?? '',
          status: ship.shipment_status,
          cars_type_name: ship.cars_type_name ?? '',
          orders,
        });
      }
    }
    // Add local cars (รถเล็ก) per DC from shipment_dc_assignment so map shows both main truck and local cars
    const shipmentIds = (shipRows || []).map((s) => s.shipment_id).filter(Boolean);
    if (shipmentIds.length > 0) {
      try {
        const placeholders = shipmentIds.map(() => '?').join(',');
        const [dcRows] = await conn.execute(
          `SELECT d.shipment_id, d.dc_branch_id, d.local_car_id, d.driver_emp_id, d.sales_emp_id
           FROM shipment_dc_assignment d
           WHERE d.shipment_id IN (${placeholders}) AND d.local_car_id IS NOT NULL`,
          shipmentIds
        );
        const shipBySid = (shipRows || []).reduce((acc, s) => { acc[s.shipment_id] = s; return acc; }, {});
        for (const dc of dcRows || []) {
          const ship = shipBySid[dc.shipment_id];
          if (!ship) continue;
          const [carRows] = await conn.execute(
            `SELECT c.car_id, c.license_plate, t.name AS cars_type_name
             FROM cars c LEFT JOIN car_type t ON c.type_id = t.type_id WHERE c.car_id = ?`,
            [dc.local_car_id]
          );
          const [empRows] = await conn.execute(
            `SELECT CONCAT(firstname, ' ', lastname) AS driver_name FROM employees WHERE emp_id = ?`,
            [dc.driver_emp_id || 0]
          );
          const driverName = empRows?.[0]?.driver_name ?? '';
          const carInfo = carRows?.[0];
          if (!carInfo) continue;
          const [[dcBranch]] = await conn.execute(
            `SELECT branch_id, name, latitude, longitude FROM branch WHERE branch_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
            [dc.dc_branch_id]
          );
          if (!dcBranch) continue;
          // วิ่งวนเฉพาะสาขาที่มี order ใน shipment นี้ (ทุกสาขาที่มี Shipment)
          const [orderRows] = await conn.execute(
            `SELECT o.order_id, o.customer_branch_id, o.status AS order_status,
              b.name AS branch_name, b.latitude, b.longitude
             FROM orders o
             JOIN branch b ON o.customer_branch_id = b.branch_id
             WHERE o.shipment_id = ? AND b.parent_branch_id = ? AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
             ORDER BY o.order_id`,
            [dc.shipment_id, dc.dc_branch_id]
          );
          const branchMap = {};
          (orderRows || []).forEach((o) => {
            const bid = o.customer_branch_id;
            const delivery_status = o.order_status === 'DELIVERED' ? 'delivered' : o.order_status === 'LOADED' ? 'loaded' : o.order_status === 'PLANNED' ? 'pending' : 'in_transit';
            if (!branchMap[bid]) {
              branchMap[bid] = {
                order_id: o.order_id,
                branch_id: bid,
                branch_name: o.branch_name ?? '',
                branch_latitude: parseFloat(o.latitude),
                branch_longitude: parseFloat(o.longitude),
                delivery_status,
              };
            } else {
              branchMap[bid].delivery_status = delivery_status === 'delivered' ? delivery_status : branchMap[bid].delivery_status;
            }
          });
          const retailerStops = Object.values(branchMap).map((b) => ({
            order_id: b.order_id,
            car_id: dc.local_car_id,
            delivery_status: b.delivery_status,
            branch_id: b.branch_id,
            branch_name: b.branch_name,
            branch_latitude: b.branch_latitude,
            branch_longitude: b.branch_longitude,
            route_routes_type: null,
            driver_name: driverName,
          }));
          const dcStop = {
            order_id: 0,
            car_id: dc.local_car_id,
            delivery_status: 'loaded',
            branch_id: dcBranch.branch_id,
            branch_name: dcBranch.name ?? 'DC',
            branch_latitude: parseFloat(dcBranch.latitude),
            branch_longitude: parseFloat(dcBranch.longitude),
            route_routes_type: null,
            driver_name: driverName,
          };
          let locOrders = [dcStop, ...retailerStops];
          // รถเล็กวิ่งเสร็จแล้วกลับศูนย์ — เพิ่มจุดกลับ DC เป็นจุดสุดท้าย
          locOrders.push({
            order_id: 0,
            car_id: dc.local_car_id,
            delivery_status: 'pending',
            branch_id: dcBranch.branch_id,
            branch_name: (dcBranch.name ?? 'DC') + ' (กลับ)',
            branch_latitude: parseFloat(dcBranch.latitude),
            branch_longitude: parseFloat(dcBranch.longitude),
            route_routes_type: null,
            driver_name: driverName,
          });
          if (String(ship.shipment_status) === 'IN_TRANSIT' && locOrders.length > 0) {
            const idx = locOrders.findIndex((o) => o.delivery_status !== 'delivered');
            if (idx >= 0) locOrders = locOrders.map((o, i) => (i === idx ? { ...o, delivery_status: 'in_transit' } : o));
          }
          if (retailerStops.length > 0) {
            cars.push({
              shipment_id: dc.shipment_id,
              car_id: dc.local_car_id,
              license_plate: carInfo.license_plate ?? '',
              status: ship.shipment_status,
              cars_type_name: carInfo.cars_type_name ?? '',
              orders: locOrders,
            });
          }
        }
      } catch (dcErr) {
        const msg = dcErr?.message || '';
        if (!msg.includes("doesn't exist") && !msg.includes('Unknown table')) console.error('By-car DC assignments:', msg);
      }
    }
    await conn.release();
    res.json({ cars });
  } catch (e) {
    console.error('By-car v2 fallback error:', e?.message || e);
    res.json({ cars: [] });
  }
}

// GET /api/cars - List cars with type
app.get('/api/cars', async (_req, res) => {
  const CARS_QUERY = `
    SELECT c.car_id, c.license_plate, c.cars_type_id, c.status,
      t.cars_type_name, t.cars_size_width, t.cars_size_length, t.cars_size_high
    FROM cars c
    JOIN cars_type t ON c.cars_type_id = t.cars_type_id
    ORDER BY c.car_id
  `
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(CARS_QUERY)
    await conn.release()
    res.json(rows || [])
  } catch (err) {
    console.error('Cars API error:', err)
    res.status(500).json({ error: err.message })
  }
})

const ORDERS_QUERY = `
  SELECT o.order_id, o.order_date, o.delivery_status,
    CONCAT(e.emp_firstname, ' ', e.emp_lastname) AS driver_name,
    b.branch_name, r.routes_name
  FROM orders o
  JOIN employees e ON o.employees_id = e.employees_id
  JOIN routes_and_branch rb ON o.routebranch_id = rb.routebranch_id
  JOIN branch b ON rb.branch_id = b.branch_id
  JOIN routes r ON rb.routes_id = r.routes_id
  ORDER BY o.order_date DESC
`;

// GET /api/orders - Return orders with driver, branch, route
app.get('/api/orders', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(ORDERS_QUERY);
    await conn.release();
    res.json(rows);
  } catch (err) {
    console.error('Orders API error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch orders' });
  }
});

// GET /api/orders/export?format=xlsx - Export all orders
app.get('/api/orders/export', async (req, res) => {
  if (req.query.format !== 'xlsx') return res.status(400).json({ error: 'Use ?format=xlsx' })
  try {
    const conn = await pool.getConnection()
    const [rows] = await conn.execute(ORDERS_QUERY)
    await conn.release()
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Orders')
    sheet.columns = [
      { header: 'Order ID', key: 'order_id', width: 12 },
      { header: 'Order Date', key: 'order_date', width: 20 },
      { header: 'Status', key: 'delivery_status', width: 14 },
      { header: 'Driver', key: 'driver_name', width: 25 },
      { header: 'Branch', key: 'branch_name', width: 25 },
      { header: 'Route', key: 'routes_name', width: 20 },
    ]
    sheet.addRows(rows)
    res.setHeader('Content-Disposition', 'attachment; filename="orders.xlsx"')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await workbook.xlsx.write(res)
  } catch (err) {
    console.error('Export error:', err)
    res.status(500).json({ error: err.message || 'Failed to export' })
  }
})

// GET /api/orders/:id - Order detail with line items
app.get('/api/orders/:id', async (req, res) => {
  const orderId = parseInt(req.params.id, 10)
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
  const ORDER_BY_ID = `
    SELECT o.order_id, o.order_date, o.delivery_status, o.routebranch_id,
      CONCAT(e.emp_firstname, ' ', e.emp_lastname) AS driver_name,
      b.branch_name, r.routes_name
    FROM orders o
    JOIN employees e ON o.employees_id = e.employees_id
    JOIN routes_and_branch rb ON o.routebranch_id = rb.routebranch_id
    JOIN branch b ON rb.branch_id = b.branch_id
    JOIN routes r ON rb.routes_id = r.routes_id
    WHERE o.order_id = ?
  `
  try {
    const conn = await pool.getConnection()
    const [headerRows] = await conn.execute(ORDER_BY_ID, [orderId])
    const [detailRows] = await conn.execute(
      `SELECT od.product_id, od.qty, od.unit_price, p.product_name
       FROM order_detail od
       JOIN product p ON od.product_id = p.product_id
       WHERE od.order_id = ? ORDER BY od.order_detail_id`,
      [orderId]
    )
    const [boxRows] = await conn.execute(
      `SELECT ob.box_size_id, ob.qty_per_box, bs.box_size_name
       FROM order_box ob
       JOIN box_size bs ON ob.box_size_id = bs.box_size_id
       WHERE ob.order_id = ? ORDER BY ob.order_box_id`,
      [orderId]
    )
    await conn.release()
    if (!headerRows?.length) return res.status(404).json({ error: 'Order not found' })
    const order = headerRows[0]
    order.items = detailRows || []
    order.boxes = (boxRows || []).map((r) => ({ box_size_id: r.box_size_id, box_size_name: r.box_size_name, qty_per_box: r.qty_per_box }))
    order.total = (detailRows || []).reduce((sum, r) => sum + (r.qty || 0) * (parseFloat(r.unit_price) || 0), 0)
    res.json(order)
  } catch (err) {
    console.error('Order detail API error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch order' })
  }
})

const VALID_DELIVERY_STATUS = ['pending', 'loaded', 'in_transit', 'delivered', 'partial_return']

// PATCH /api/orders/:id/delivery-status - Update delivery status, deduct stock when delivered
app.patch('/api/orders/:id/delivery-status', async (req, res) => {
  const orderId = parseInt(req.params.id, 10)
  const { delivery_status: newStatus } = req.body
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
  if (!newStatus || !VALID_DELIVERY_STATUS.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid delivery_status. Use: pending, loaded, in_transit, delivered, partial_return' })
  }
  try {
    const conn = await pool.getConnection()
    await conn.beginTransaction()
    const [[order]] = await conn.execute(
      'SELECT order_id, delivery_status FROM orders WHERE order_id = ?',
      [orderId]
    )
    if (!order) {
      await conn.rollback()
      await conn.release()
      return res.status(404).json({ error: 'Order not found' })
    }
    const oldStatus = order.delivery_status
    await conn.execute(
      'UPDATE orders SET delivery_status = ? WHERE order_id = ?',
      [newStatus, orderId]
    )
    if (newStatus === 'delivered' && oldStatus !== 'delivered') {
      const [details] = await conn.execute(
        'SELECT product_id, lot_id, qty FROM order_detail WHERE order_id = ?',
        [orderId]
      )
      const factoryIds = await conn.execute(
        'SELECT DISTINCT location_id FROM inventory_stocks'
      ).then(([rows]) => (rows || []).map((r) => r.location_id))
      if (factoryIds.length === 0) {
        await conn.rollback()
        await conn.release()
        return res.status(500).json({ error: 'No factory stock locations found' })
      }
      for (const d of details || []) {
        const qty = parseInt(d.qty, 10) || 0
        if (qty <= 0) continue
        let lotId = d.lot_id ? parseInt(d.lot_id, 10) : null
        if (!lotId) {
          const inClause = factoryIds.map(() => '?').join(',')
          const [lots] = await conn.execute(
            `SELECT ld.lot_id FROM lot_definitions ld
             JOIN inventory_stocks inv ON inv.lot_id = ld.lot_id
             WHERE ld.product_id = ? AND inv.location_id IN (${inClause}) AND inv.status = 'Available' AND inv.quantity >= ?
             ORDER BY ld.manufacturing_date ASC LIMIT 1`,
            [d.product_id, ...factoryIds, qty]
          )
          lotId = lots?.[0]?.lot_id
        }
        if (!lotId) {
          await conn.rollback()
          await conn.release()
          return res.status(400).json({
            error: `Insufficient stock for product_id ${d.product_id} (need ${qty}). Specify lot_id in order_detail or ensure factory has available stock.`,
          })
        }
        const inClause2 = factoryIds.map(() => '?').join(',')
        const [updated] = await conn.execute(
          `UPDATE inventory_stocks SET quantity = quantity - ? 
           WHERE lot_id = ? AND location_id IN (${inClause2}) AND quantity >= ? AND status = 'Available'`,
          [qty, lotId, ...factoryIds, qty]
        )
        if (updated.affectedRows === 0) {
          await conn.rollback()
          await conn.release()
          return res.status(400).json({
            error: `Insufficient stock for lot_id ${lotId} (need ${qty})`,
          })
        }
      }
    }
    await conn.commit()
    await conn.release()
    res.json({ order_id: orderId, delivery_status: newStatus, success: true })
  } catch (err) {
    console.error('Delivery status update error:', err)
    res.status(500).json({ error: err.message || 'Failed to update delivery status' })
  }
})

// POST /api/order-suggest - AI order suggestion per branch with capacity and vehicle split
app.post('/api/order-suggest', async (req, res) => {
  const { routebranch_ids, branch_ids, insights, product_ids, products, branch_comments, box_size, main_truck, local_car } = req.body
  const rbIds = Array.isArray(routebranch_ids) ? routebranch_ids.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)) : []
  const bIds = Array.isArray(branch_ids) ? branch_ids : []
  const prodList = Array.isArray(products) ? products : []
  if (rbIds.length === 0) return res.status(400).json({ error: 'routebranch_ids required' })

  const box = box_size && typeof box_size === 'object' ? box_size : null
  const truck = main_truck && typeof main_truck === 'object' ? main_truck : null
  const car = local_car && typeof local_car === 'object' ? local_car : null

  const isDev = process.env.NODE_ENV !== 'production'
  if (!OPENCLAW_TOKEN && isDev) {
    const half = Math.ceil(rbIds.length / 2)
    const qtyPerMain = Math.max(50, Math.floor(1700 / (half * 3)))
    const qtyPerLocal = Math.max(30, Math.floor(300 / (Math.max(1, rbIds.length - half) * 3)))
    const devBranches = rbIds.map((rbId, i) => {
      const isMain = i < half
      const qty = isMain ? qtyPerMain : qtyPerLocal
      const items = (prodList.slice(0, 3) || []).map((p, j) => ({
        product_id: p.product_id,
        product_name: p.product_name || `Product ${j + 1}`,
        qty,
        unit_price: p.unit_price || 35,
        total: (p.unit_price || 35) * qty,
      }))
      return {
        routebranch_id: rbId,
        branch_name: `Branch ${rbId}`,
        similarity_pct: 96,
        vehicle: isMain ? 'main' : 'local',
        items,
        total_qty: items.reduce((s, it) => s + it.qty, 0),
        total_price: items.reduce((s, it) => s + it.total, 0),
      }
    })
    return res.json({ branches: devBranches })
  }
  if (!OPENCLAW_TOKEN) return res.status(500).json({ error: 'OPENCLAW_GATEWAY_TOKEN required' })

  const insightsStr = JSON.stringify(insights || {})
  const commentsStr = JSON.stringify(branch_comments || {})
  const productsStr = JSON.stringify(prodList.slice(0, 20))
  const boxStr = box ? JSON.stringify(box) : 'null'
  const truckStr = truck ? JSON.stringify(truck) : 'null'
  const carStr = car ? JSON.stringify(car) : 'null'

  const capacityInstructions = (box && truck && car)
    ? `
CAPACITY LOGIC (CRITICAL - FILL THE VEHICLES):
- Box size (cm): ${boxStr}. Box volume = width * length * height (cm³).
- Main truck (m): ${truckStr}. Use stacking: max_boxes = floor(L/box_l) * floor(W/box_w) * floor(H/box_h) for best orientation (~2000+ boxes for 10-wheel).
- Local car (m): ${carStr}. Same stacking formula (~300-400 boxes for 4-wheel pickup).
- Products have product_size_width, product_size_length, product_size_high (cm). Product volume = w*l*h.
- For each branch: total_volume = sum(qty * product_volume). Boxes = ceil(total_volume / (box_volume * 0.8)).
- TARGET: Use 70-90% of each vehicle capacity. Total boxes for "main" branches should reach ~80% of main truck max. Total for "local" branches ~80% of local car max.
- Suggest LARGER quantities per product (e.g. 20-100+ per item depending on branch size) so that combined orders fill the trucks. Do NOT suggest tiny quantities like 2-3 each.
- Assign vehicle: main truck first (by route order), then local car. Add "vehicle": "main" or "vehicle": "local" per branch.`
    : ''

  const prompt = `You are an order planner for a bread logistics company. Given:
- Selected route-branch IDs (in order): ${rbIds.join(', ')}
- Branch IDs: ${bIds.join(', ')}
- Insights per branch (customer, peak_time, product): ${insightsStr}
- Branch-specific notes/situations: ${commentsStr}
- Available products (with product_size_width, product_size_length, product_size_high in cm): ${productsStr}
- Box size for packing (cm): ${boxStr}
- Main truck dimensions (m): ${truckStr}
- Local car dimensions (m): ${carStr}
${capacityInstructions}

Return a JSON object with this exact structure (no markdown, no extra text):
{"branches":[{"routebranch_id":number,"branch_name":"string","similarity_pct":number,"vehicle":"main"|"local","items":[{"product_id":number,"product_name":"string","qty":number,"unit_price":number,"total":number}],"total_qty":number,"total_price":number}]}

For each routebranch_id, suggest 3-6 product items with LARGE quantities (aim to fill 70-90% of vehicle capacity across all branches; use qty 15-80+ per item as needed). Consider insights for which products to prioritize. Set similarity_pct 90-99. Calculate total = qty * unit_price per item, total_qty = sum of qty, total_price = sum of total.${(box && truck && car) ? ' CRITICAL: Suggest enough quantity so main truck and local car each reach ~80% capacity. Assign vehicle (main or local): fill main truck first, then local car.' : ''}`

  try {
    const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages: [
          { role: 'system', content: 'You respond only with valid JSON. No markdown, no code fences, no explanation.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
        user: 'web',
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText || response.statusText })
    }
    const data = await response.json()
    const content = (data.choices?.[0]?.message?.content || '').trim()
    let parsed
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {}
    }
    if (!parsed?.branches) {
      const half = Math.ceil(rbIds.length / 2)
      const qtyPerMain = Math.max(50, Math.floor(1700 / (half * 3)))
      const qtyPerLocal = Math.max(30, Math.floor(300 / (Math.max(1, rbIds.length - half) * 3)))
      return res.json({
        branches: rbIds.map((rbId, i) => {
          const isMain = i < half
          const qty = isMain ? qtyPerMain : qtyPerLocal
          const items = prodList.slice(0, 3).map((p) => ({
            product_id: p.product_id,
            product_name: p.product_name,
            qty,
            unit_price: p.unit_price || 35,
            total: (p.unit_price || 35) * qty,
          }))
          return {
            routebranch_id: rbId,
            branch_name: `Branch ${rbId}`,
            similarity_pct: 95,
            vehicle: isMain ? 'main' : 'local',
            items,
            total_qty: items.reduce((s, it) => s + it.qty, 0),
            total_price: items.reduce((s, it) => s + it.total, 0),
          }
        }),
      })
    }
    parsed.branches = (parsed.branches || []).map((b, i) => ({
      ...b,
      vehicle: b.vehicle || (i < Math.ceil((parsed.branches || []).length / 2) ? 'main' : 'local'),
    }))
    res.json(parsed)
  } catch (err) {
    console.error('Order suggest API error:', err)
    res.status(500).json({ error: err.message || 'Failed to get AI suggestion' })
  }
})

// POST /api/orders - Create new order
app.post('/api/orders', async (req, res) => {
  const { employees_id, routebranch_id, car_id, lotID, items } = req.body
  if (!employees_id || !routebranch_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Missing required fields: employees_id, routebranch_id, and at least one item (product_id, qty)',
    })
  }
  const empId = parseInt(employees_id, 10)
  const rbId = parseInt(routebranch_id, 10)
  const carIdVal = car_id ? parseInt(car_id, 10) : null
  const defaultLot = lotID ? parseInt(lotID, 10) : null
  if (isNaN(empId) || isNaN(rbId)) return res.status(400).json({ error: 'Invalid employees_id or routebranch_id' })
  const validItems = items
    .filter((i) => i.product_id && (i.qty || 0) > 0)
    .map((i) => ({
      product_id: parseInt(i.product_id, 10),
      qty: parseInt(i.qty, 10) || 1,
      unit_price: parseFloat(i.unit_price) || 0,
      lot_id: i.lot_id != null ? parseInt(i.lot_id, 10) : defaultLot,
    }))
  if (validItems.length === 0) return res.status(400).json({ error: 'Add at least one product with quantity > 0' })

  try {
    const conn = await pool.getConnection()
    await conn.beginTransaction()
    const [orderResult] = await conn.execute(
      `INSERT INTO orders (delivery_status, employees_id, routebranch_id, car_id) VALUES ('pending', ?, ?, ?)`,
      [empId, rbId, carIdVal]
    )
    const orderId = orderResult.insertId
    if (carIdVal) {
      const [[rb]] = await conn.execute('SELECT routes_id FROM routes_and_branch WHERE routebranch_id = ?', [rbId])
      if (rb?.routes_id) {
        const today = new Date().toISOString().slice(0, 10)
        const [[existing]] = await conn.execute(
          'SELECT route_car_id FROM route_car WHERE routes_id = ? AND car_id = ? AND start_date = ?',
          [rb.routes_id, carIdVal, today]
        )
        if (!existing) {
          await conn.execute(
            'INSERT INTO route_car (routes_id, car_id, start_date) VALUES (?, ?, ?)',
            [rb.routes_id, carIdVal, today]
          )
        }
      }
    }
    for (const item of validItems) {
      if (isNaN(item.product_id) || item.qty < 1) continue
      let price = item.unit_price
      if (!price || price <= 0) {
        const [[p]] = await conn.execute('SELECT unit_price FROM product WHERE product_id = ?', [item.product_id])
        price = p?.unit_price ?? 0
      }
      const lotId = item.lot_id && !isNaN(item.lot_id) ? item.lot_id : null
      await conn.execute(
        `INSERT INTO order_detail (order_id, product_id, lot_id, qty, unit_price) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, lotId, item.qty, price]
      )
    }
    await conn.commit()
    await conn.release()
    res.status(201).json({ order_id: orderId, success: true })
  } catch (err) {
    console.error('Create order error:', err)
    res.status(500).json({ error: err.message || 'Failed to create order' })
  }
})

// Database connection test
app.get('/api/db-status', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.execute('SELECT 1');
    await conn.release();
    res.json({ database: 'connected' });
  } catch (err) {
    res.status(500).json({
      database: 'disconnected',
      error: err.message || 'Connection failed',
    });
  }
});

// ---------- V2 API (bread_logistics_v2) - Create Shipment Plan ----------
function getV2Conn() {
  return poolV2.getConnection();
}

// GET /api/v2/routes
app.get('/api/v2/routes', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute('SELECT route_id, name, description FROM routes ORDER BY name');
    await conn.release();
    res.json((rows || []).map((r) => ({ route_id: r.route_id, name: r.name ?? '', description: r.description ?? null })));
  } catch (err) {
    console.error('V2 routes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/route-stops/:routeId - stops with branch name and cat_id (for DC vs Retailer)
app.get('/api/v2/route-stops/:routeId', async (req, res) => {
  const routeId = parseInt(req.params.routeId, 10);
  if (isNaN(routeId)) return res.status(400).json({ error: 'Invalid route_id' });
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT rs.stop_id, rs.route_id, rs.branch_id, rs.stop_sequence, rs.estimated_travel_min,
        b.name AS branch_name, b.cat_id
       FROM route_stops rs
       JOIN branch b ON rs.branch_id = b.branch_id
       WHERE rs.route_id = ?
       ORDER BY rs.stop_sequence`,
      [routeId]
    );
    await conn.release();
    res.json(rows || []);
  } catch (err) {
    console.error('V2 route-stops error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/branches/:branch_id/retailers - Retailers supplied by this DC (parent_branch_id link, no distance)
const RETAILER_CAT_ID = 3;
app.get('/api/v2/branches/:branch_id/retailers', async (req, res) => {
  const branchId = parseInt(req.params.branch_id, 10);
  if (isNaN(branchId)) return res.status(400).json({ error: 'Invalid branch_id' });
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT branch_id, name, cat_id, parent_branch_id
       FROM branch
       WHERE parent_branch_id = ? AND cat_id = ?
       ORDER BY name`,
      [branchId, RETAILER_CAT_ID]
    );
    await conn.release();
    res.json((rows || []).map((r) => ({
      branch_id: r.branch_id,
      name: r.name ?? '',
      branch_name: r.name ?? '',
      cat_id: r.cat_id,
      parent_branch_id: r.parent_branch_id,
    })));
  } catch (err) {
    console.error('V2 branches/retailers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/cars - ?type=10-wheel or type=4-wheel (optional); ?available=1 = exclude cars assigned to PLANNING/LOADING/IN_TRANSIT
app.get('/api/v2/cars', async (req, res) => {
  const typeFilter = (req.query.type || '').toLowerCase();
  const availableOnly = req.query.available === '1' || req.query.available === 'true';
  try {
    const conn = await getV2Conn();
    let sql = `SELECT c.car_id, c.license_plate, c.type_id, c.status, 
        t.name AS type_name, t.max_load_weight_kg, t.max_load_volume_m3
       FROM cars c
       JOIN car_type t ON c.type_id = t.type_id`;
    if (availableOnly) {
      sql += ` WHERE c.car_id NOT IN (
        SELECT s.car_id FROM shipments s
        WHERE s.status IN ('PLANNING', 'LOADING', 'IN_TRANSIT')
      )`;
    }
    sql += ' ORDER BY c.car_id';
    const [rows] = await conn.execute(sql);
    await conn.release();
    let list = rows || [];
    if (typeFilter) {
      list = list.filter((r) => (r.type_name || '').toLowerCase().includes(typeFilter));
    }
    res.json(list);
  } catch (err) {
    console.error('V2 cars error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/employees - ?job_id=1 or ?job_title=Driver (match job_description.title)
app.get('/api/v2/employees', async (req, res) => {
  const jobId = req.query.job_id != null ? parseInt(req.query.job_id, 10) : null;
  const jobTitle = (req.query.job_title || '').trim();
  try {
    const conn = await getV2Conn();
    let sql = `SELECT e.emp_id, e.firstname, e.lastname, e.job_id, j.title AS job_title,
      CONCAT(e.firstname, ' ', e.lastname) AS full_name
      FROM employees e
      JOIN job_description j ON e.job_id = j.job_id
      WHERE e.is_active = 1`;
    const params = [];
    if (!isNaN(jobId) && jobId > 0) {
      sql += ' AND e.job_id = ?';
      params.push(jobId);
    }
    if (jobTitle) {
      sql += ' AND LOWER(j.title) LIKE ?';
      params.push(`%${jobTitle.toLowerCase()}%`);
    }
    sql += ' ORDER BY e.firstname, e.lastname';
    const [rows] = await conn.execute(sql, params);
    await conn.release();
    res.json(rows || []);
  } catch (err) {
    console.error('V2 employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/products
app.get('/api/v2/products', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT product_id, name, unit_price, barcode, description,
        width_cm, height_cm, length_cm
       FROM product WHERE is_active = 1 ORDER BY name`
    );
    await conn.release();
    const defaultVol = 0.02; // m³ per unit if no dimensions
    res.json((rows || []).map((r) => {
      const w = parseFloat(r.width_cm) || 0;
      const h = parseFloat(r.height_cm) || 0;
      const l = parseFloat(r.length_cm) || 0;
      const volume_m3 = w && h && l ? (w * h * l) / 1e6 : defaultVol;
      return {
        product_id: r.product_id,
        name: r.name ?? '',
        unit_price: parseFloat(r.unit_price) || 0,
        barcode: r.barcode,
        description: r.description,
        volume_m3,
      };
    }));
  } catch (err) {
    console.error('V2 products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/branch-categories
app.get('/api/v2/branch-categories', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute('SELECT cat_id, name, description FROM branch_category ORDER BY cat_id');
    await conn.release();
    res.json(rows || []);
  } catch (err) {
    console.error('V2 branch-categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/orders - List orders created from shipment plans
app.get('/api/v2/orders', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT o.order_id, o.order_code, o.order_date, o.status,
        o.customer_branch_id,
        b.name AS branch_name,
        s.shipment_id, s.shipment_code,
        r.name AS route_name,
        CONCAT(ed.firstname, ' ', ed.lastname) AS driver_name,
        CONCAT(es.firstname, ' ', es.lastname) AS sales_name
       FROM orders o
       JOIN branch b ON o.customer_branch_id = b.branch_id
       LEFT JOIN shipments s ON o.shipment_id = s.shipment_id
       LEFT JOIN routes r ON s.route_id = r.route_id
       LEFT JOIN employees ed ON s.driver_emp_id = ed.emp_id
       LEFT JOIN employees es ON s.sales_emp_id = es.emp_id
       ORDER BY o.order_date DESC, o.order_id DESC`
    );
    await conn.release();
    res.json((rows || []).map((r) => ({
      order_id: r.order_id,
      order_code: r.order_code ?? null,
      order_date: r.order_date ?? null,
      status: r.status ?? null,
      customer_branch_id: r.customer_branch_id ?? null,
      branch_name: r.branch_name ?? '',
      shipment_id: r.shipment_id ?? null,
      shipment_code: r.shipment_code ?? null,
      route_name: r.route_name ?? null,
      driver_name: r.driver_name ?? null,
      sales_name: r.sales_name ?? null,
    })));
  } catch (err) {
    console.error('V2 orders error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch v2 orders' });
  }
});

// GET /api/v2/orders/:id - Order detail with line items (order_items)
app.get('/api/v2/orders/:id', async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
  try {
    const conn = await getV2Conn();
    const [headerRows] = await conn.execute(
      `SELECT o.order_id, o.order_code, o.order_date, o.status,
        o.customer_branch_id,
        b.name AS branch_name,
        s.shipment_id, s.shipment_code,
        r.name AS route_name,
        CONCAT(ed.firstname, ' ', ed.lastname) AS driver_name,
        CONCAT(es.firstname, ' ', es.lastname) AS sales_name
       FROM orders o
       JOIN branch b ON o.customer_branch_id = b.branch_id
       LEFT JOIN shipments s ON o.shipment_id = s.shipment_id
       LEFT JOIN routes r ON s.route_id = r.route_id
       LEFT JOIN employees ed ON s.driver_emp_id = ed.emp_id
       LEFT JOIN employees es ON s.sales_emp_id = es.emp_id
       WHERE o.order_id = ?`,
      [orderId]
    );
    if (!headerRows?.length) {
      await conn.release();
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = headerRows[0];
    const [items] = await conn.execute(
      `SELECT oi.product_id, p.name AS product_name,
        oi.requested_qty, oi.fulfilled_qty, oi.unit_price_at_order
       FROM order_items oi
       JOIN product p ON oi.product_id = p.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.item_id`,
      [orderId]
    );
    await conn.release();
    const detail = {
      order_id: order.order_id,
      order_code: order.order_code ?? null,
      order_date: order.order_date ?? null,
      status: order.status ?? null,
      customer_branch_id: order.customer_branch_id ?? null,
      branch_name: order.branch_name ?? '',
      shipment_id: order.shipment_id ?? null,
      shipment_code: order.shipment_code ?? null,
      route_name: order.route_name ?? null,
      driver_name: order.driver_name ?? null,
      sales_name: order.sales_name ?? null,
      items: (items || []).map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name ?? '',
        requested_qty: it.requested_qty ?? 0,
        fulfilled_qty: it.fulfilled_qty ?? 0,
        unit_price_at_order: it.unit_price_at_order ?? 0,
      })),
    };
    detail.total = (detail.items || []).reduce(
      (sum, it) => sum + (parseInt(it.requested_qty, 10) || 0) * (parseFloat(it.unit_price_at_order) || 0),
      0
    );
    res.json(detail);
  } catch (err) {
    console.error('V2 order detail error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch v2 order' });
  }
});

// GET /api/v2/orders/export?format=xlsx - Export v2 orders
app.get('/api/v2/orders/export', async (req, res) => {
  if (req.query.format !== 'xlsx') return res.status(400).json({ error: 'Use ?format=xlsx' });
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT o.order_id, o.order_code, o.order_date, o.status,
        b.name AS branch_name,
        s.shipment_code,
        r.name AS route_name,
        CONCAT(ed.firstname, ' ', ed.lastname) AS driver_name,
        CONCAT(es.firstname, ' ', es.lastname) AS sales_name
       FROM orders o
       JOIN branch b ON o.customer_branch_id = b.branch_id
       LEFT JOIN shipments s ON o.shipment_id = s.shipment_id
       LEFT JOIN routes r ON s.route_id = r.route_id
       LEFT JOIN employees ed ON s.driver_emp_id = ed.emp_id
       LEFT JOIN employees es ON s.sales_emp_id = es.emp_id
       ORDER BY o.order_date DESC, o.order_id DESC`
    );
    await conn.release();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');
    sheet.columns = [
      { header: 'Order ID', key: 'order_id', width: 12 },
      { header: 'Order Code', key: 'order_code', width: 20 },
      { header: 'Order Date', key: 'order_date', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Branch', key: 'branch_name', width: 25 },
      { header: 'Shipment', key: 'shipment_code', width: 22 },
      { header: 'Route', key: 'route_name', width: 22 },
      { header: 'Driver', key: 'driver_name', width: 25 },
      { header: 'Sales', key: 'sales_name', width: 25 },
    ];
    sheet.addRows(rows || []);
    res.setHeader('Content-Disposition', 'attachment; filename="orders-v2.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
  } catch (err) {
    console.error('V2 orders export error:', err);
    res.status(500).json({ error: err.message || 'Failed to export v2 orders' });
  }
});

// GET /api/returns - List returns (bread_logistics_v2: returns + return_items)
app.get('/api/returns', async (req, res) => {
  const { days, from, to, original_order_id } = req.query;
  let dateCondition = '';
  const params = [];
  if (original_order_id != null && original_order_id !== '') {
    const oid = parseInt(original_order_id, 10);
    if (!isNaN(oid)) {
      dateCondition += ' AND r.original_order_id = ?';
      params.push(oid);
    }
  }
  if (days != null && days !== '') {
    const d = parseInt(days, 10);
    if (!isNaN(d) && d >= 0) {
      dateCondition += ' AND DATE(r.return_date) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      params.push(d);
    }
  } else if (from && to) {
    dateCondition += ' AND DATE(r.return_date) >= ? AND DATE(r.return_date) <= ?';
    params.push(from, to);
  } else if (!original_order_id || original_order_id === '') {
    dateCondition += ' AND DATE(r.return_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
  }
  const sql = `
    SELECT r.return_id, r.original_order_id AS order_id, r.return_date, r.reason, r.status,
           b.name AS branch_name,
           rt.name AS route_name,
           (SELECT COALESCE(SUM(ri.qty), 0) FROM return_items ri WHERE ri.return_id = r.return_id) AS total_qty
    FROM returns r
    LEFT JOIN orders o ON r.original_order_id = o.order_id
    LEFT JOIN branch b ON o.customer_branch_id = b.branch_id
    LEFT JOIN shipments s ON o.shipment_id = s.shipment_id
    LEFT JOIN routes rt ON s.route_id = rt.route_id
    WHERE 1=1 ${dateCondition}
    ORDER BY r.return_id DESC
  `;
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(sql, params);
    await conn.release();
    res.json(rows || []);
  } catch (err) {
    console.error('Returns list API error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch returns' });
  }
});

// GET /api/returns/:id - Single return with line items
app.get('/api/returns/:id', async (req, res) => {
  const returnId = parseInt(req.params.id, 10);
  if (isNaN(returnId)) return res.status(400).json({ error: 'Invalid return ID' });
  try {
    const conn = await getV2Conn();
    const [headerRows] = await conn.execute(
      `SELECT r.return_id, r.original_order_id AS order_id, r.return_date, r.reason, r.status,
              b.name AS branch_name,
              rt.name AS route_name
       FROM returns r
       LEFT JOIN orders o ON r.original_order_id = o.order_id
       LEFT JOIN branch b ON o.customer_branch_id = b.branch_id
       LEFT JOIN shipments s ON o.shipment_id = s.shipment_id
       LEFT JOIN routes rt ON s.route_id = rt.route_id
       WHERE r.return_id = ?`,
      [returnId]
    );
    const [detailRows] = await conn.execute(
      `SELECT ri.product_id, ri.qty, ri.condition_note, p.name AS product_name
       FROM return_items ri
       JOIN product p ON ri.product_id = p.product_id
       WHERE ri.return_id = ?
       ORDER BY ri.ret_item_id`,
      [returnId]
    );
    await conn.release();
    if (!headerRows || headerRows.length === 0) return res.status(404).json({ error: 'Return not found' });
    const ret = headerRows[0];
    ret.items = (detailRows || []).map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name ?? '',
      qty: it.qty ?? 0,
      condition_note: it.condition_note ?? '',
    }));
    res.json(ret);
  } catch (err) {
    console.error('Return detail API error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch return' });
  }
});

// POST /api/returns - Create return
app.post('/api/returns', async (req, res) => {
  const { original_order_id, return_date, reason, status, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required' });
  }
  const validItems = items.filter((i) => i.product_id != null && (parseInt(i.qty, 10) || 0) > 0);
  if (validItems.length === 0) {
    return res.status(400).json({ error: 'At least one item must have qty > 0' });
  }
  const orderId = original_order_id != null ? parseInt(original_order_id, 10) : null;
  if (orderId == null || isNaN(orderId)) {
    return res.status(400).json({ error: 'original_order_id is required' });
  }
  const dateVal = return_date || null;
  const reasonVal = reason != null ? String(reason) : null;
  const statusVal = status && ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED'].includes(status) ? status : 'REQUESTED';
  let conn;
  try {
    conn = await getV2Conn();
    await conn.beginTransaction();
    const [ins] = await conn.execute(
      `INSERT INTO returns (original_order_id, return_date, reason, status) VALUES (?, ?, ?, ?)`,
      [orderId, dateVal, reasonVal, statusVal]
    );
    const returnId = ins.insertId;
    for (const it of validItems) {
      await conn.execute(
        `INSERT INTO return_items (return_id, product_id, qty, condition_note) VALUES (?, ?, ?, ?)`,
        [returnId, parseInt(it.product_id, 10), parseInt(it.qty, 10) || 0, it.condition_note != null ? String(it.condition_note) : null]
      );
    }
    await conn.commit();
    await conn.release();
    res.status(201).json({ return_id: returnId });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
        await conn.release();
      } catch (_) {}
    }
    console.error('Create return API error:', err);
    res.status(500).json({ error: err.message || 'Failed to create return' });
  }
});

// OpenClaw allocation: suggest quantities to fill ~70% of car capacity per branch
const ALLOC_OPENCLAW_TIMEOUT_MS = 25000;
const DEFAULT_CAR_CAPACITY_M3 = 12;
const TARGET_CAPACITY_PCT = 0.7;

async function tryOpenClawAllocation(branchIds, productIds, carCapacityM3 = DEFAULT_CAR_CAPACITY_M3) {
  if (!OPENCLAW_TOKEN || branchIds.length === 0) return null;
  let conn;
  try {
    conn = await getV2Conn();
    const placeholders = (productIds.length > 0 ? productIds : [0]).map(() => '?').join(',');
    const [rows] = await conn.execute(
      `SELECT product_id, name, unit_price, width_cm, height_cm, length_cm
       FROM product WHERE is_active = 1 ${productIds.length > 0 ? `AND product_id IN (${placeholders})` : ''} ORDER BY name`,
      productIds.length > 0 ? productIds : []
    );
    await conn.release();
    conn = null;
    const defaultVol = 0.02;
    const products = (rows || []).map((r) => {
      const w = parseFloat(r.width_cm) || 0;
      const h = parseFloat(r.height_cm) || 0;
      const l = parseFloat(r.length_cm) || 0;
      const volume_m3 = w && h && l ? (w * h * l) / 1e6 : defaultVol;
      return { product_id: r.product_id, name: r.name ?? '', unit_price: parseFloat(r.unit_price) || 0, volume_m3 };
    });
    if (products.length === 0) return null;
    const targetVolumeM3 = carCapacityM3 * TARGET_CAPACITY_PCT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ALLOC_OPENCLAW_TIMEOUT_MS);
    const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages: [
          {
            role: 'system',
            content: 'You respond only with valid JSON. No markdown, no code fences, no explanation. Output format: {"allocations":[{"branch_id":number,"product_id":number,"suggested_qty":number},...]}',
          },
          {
            role: 'user',
            content: `You are an allocation planner for a logistics company. Fill each branch's delivery to about 70% of the car capacity (OpenClaw method).

Branch IDs: ${branchIds.join(', ')}
Products (with volume per unit in m³): ${JSON.stringify(products.map((p) => ({ product_id: p.product_id, name: p.name, volume_m3: p.volume_m3 })))}
Car capacity per branch: ${carCapacityM3} m³. TARGET volume per branch: ${targetVolumeM3.toFixed(2)} m³ (70% of capacity).

For each branch_id and each product_id, suggest suggested_qty (non-negative integer) so that for each branch the total volume (sum of qty * product.volume_m3) is approximately ${targetVolumeM3.toFixed(2)} m³. Prefer spreading across 3-6 products per branch. Use reasonable quantities (e.g. 5-80 per product). Return every combination of branch_id and product_id that you assign a non-zero quantity.

Return ONLY this JSON: {"allocations":[{"branch_id":<number>,"product_id":<number>,"suggested_qty":<number>},...]}`,
          },
        ],
        stream: false,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.allocations) || parsed.allocations.length === 0) return null;
    const valid = parsed.allocations
      .filter((a) => branchIds.includes(Number(a.branch_id)) && products.some((p) => p.product_id === Number(a.product_id)))
      .map((a) => ({
        branch_id: parseInt(a.branch_id, 10),
        product_id: parseInt(a.product_id, 10),
        suggested_qty: Math.max(0, parseInt(a.suggested_qty, 10) || 0),
        avg_sales_7d: 0,
        current_stock: 0,
      }))
      .filter((a) => a.suggested_qty > 0);
    return valid.length > 0 ? { allocations: valid } : null;
  } catch (err) {
    if (err.name !== 'AbortError') console.error('OpenClaw allocation error:', err);
    if (conn) try { await conn.release(); } catch (_) {}
    return null;
  }
}

// Shared: AI allocation (suggested qty = sales_7d * 1.10 - stock; stock by product via lot_definitions)
const PAR_LEVEL = 50;
const ALLOC_BUFFER = 1.1;
async function runAllocationCalculation(branchIds, productIds = []) {
  const conn = await getV2Conn();
  const placeholders = branchIds.map(() => '?').join(',');
  const [salesRows] = await conn.execute(
    `SELECT o.customer_branch_id AS branch_id, oi.product_id,
      SUM(oi.requested_qty) AS sales_7d
     FROM orders o
     JOIN order_items oi ON o.order_id = oi.order_id
     WHERE o.customer_branch_id IN (${placeholders})
       AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       AND o.status IN ('DELIVERED','LOADED','PLANNED','PENDING')
     GROUP BY o.customer_branch_id, oi.product_id`,
    branchIds
  );
  const [stockRows] = await conn.execute(
    `SELECT inv.branch_id, ld.product_id, SUM(inv.quantity) AS current_stock
     FROM inventory_stock inv
     JOIN lot_definitions ld ON inv.lot_id = ld.lot_id
     WHERE inv.branch_id IN (${placeholders})
       AND inv.status IN ('AVAILABLE','RESERVED')
     GROUP BY inv.branch_id, ld.product_id`,
    branchIds
  );
  await conn.release();
  const salesMap = {};
  (salesRows || []).forEach((r) => {
    const key = `${r.branch_id}:${r.product_id}`;
    salesMap[key] = (salesMap[key] || 0) + (r.sales_7d || 0);
  });
  const stockMap = {};
  (stockRows || []).forEach((r) => {
    const key = `${r.branch_id}:${r.product_id}`;
    stockMap[key] = (stockMap[key] || 0) + Math.max(0, r.current_stock || 0);
  });
  const result = [];
  const seen = new Set();
  branchIds.forEach((branchId) => {
    Object.keys(salesMap).forEach((key) => {
      if (!key.startsWith(`${branchId}:`)) return;
      const productId = parseInt(key.split(':')[1], 10);
      const pair = `${branchId}:${productId}`;
      if (seen.has(pair)) return;
      seen.add(pair);
      const sales7d = salesMap[key] || 0;
      const stock = stockMap[key] != null ? stockMap[key] : 0;
      const suggested = sales7d > 0
        ? Math.max(0, Math.floor(sales7d * ALLOC_BUFFER - stock))
        : Math.max(0, PAR_LEVEL - stock);
      result.push({ branch_id: branchId, product_id: productId, suggested_qty: suggested, avg_sales_7d: sales7d, current_stock: stock });
    });
  });
  branchIds.forEach((branchId) => {
    Object.keys(stockMap).forEach((key) => {
      if (!key.startsWith(`${branchId}:`)) return;
      const productId = parseInt(key.split(':')[1], 10);
      const pair = `${branchId}:${productId}`;
      if (seen.has(pair)) return;
      seen.add(pair);
      const stock = Math.max(0, stockMap[key] || 0);
      result.push({ branch_id: branchId, product_id: productId, suggested_qty: Math.max(0, PAR_LEVEL - stock), avg_sales_7d: 0, current_stock: stock });
    });
  });
  if (productIds.length > 0) {
    branchIds.forEach((branchId) => {
      productIds.forEach((productId) => {
        const pair = `${branchId}:${productId}`;
        if (seen.has(pair)) return;
        seen.add(pair);
        result.push({ branch_id: branchId, product_id: productId, suggested_qty: PAR_LEVEL, avg_sales_7d: 0, current_stock: 0 });
      });
    });
  }
  return { allocations: result };
}

const DEFAULT_VOLUME_M3 = 0.02;

/** Fetch product_id -> volume_m3 (from dimensions or default). */
async function getProductsWithVolume(conn, productIds = null) {
  const ids = Array.isArray(productIds) && productIds.length > 0 ? productIds : null;
  const [rows] = ids
    ? await conn.execute(
        `SELECT product_id, width_cm, height_cm, length_cm FROM product WHERE is_active = 1 AND product_id IN (${ids.map(() => '?').join(',')})`,
        ids
      )
    : await conn.execute(
        'SELECT product_id, width_cm, height_cm, length_cm FROM product WHERE is_active = 1'
      );
  const map = {};
  (rows || []).forEach((r) => {
    const w = parseFloat(r.width_cm) || 0;
    const h = parseFloat(r.height_cm) || 0;
    const l = parseFloat(r.length_cm) || 0;
    map[r.product_id] = w && h && l ? (w * h * l) / 1e6 : DEFAULT_VOLUME_M3;
  });
  return map;
}

/** Scale allocations so each branch total volume reaches ~targetPct of carCapacityM3 (e.g. 0.7). */
function scaleAllocationsToTargetCapacity(allocations, productVolumeM3, branchIds, carCapacityM3, targetPct = 0.7) {
  if (!allocations.length || carCapacityM3 <= 0) return allocations;
  const targetPerBranch = carCapacityM3 * targetPct;
  const byBranch = {};
  branchIds.forEach((bid) => { byBranch[bid] = []; });
  allocations.forEach((a) => {
    const bid = a.branch_id;
    if (byBranch[bid]) byBranch[bid].push(a);
  });
  const out = [];
  Object.keys(byBranch).forEach((bid) => {
    const list = byBranch[bid];
    let currentVol = 0;
    list.forEach((a) => {
      const vol = (productVolumeM3[a.product_id] ?? DEFAULT_VOLUME_M3) * (a.suggested_qty || 0);
      currentVol += vol;
    });
    if (currentVol <= 0) {
      out.push(...list);
      return;
    }
    const needVol = targetPerBranch - currentVol;
    if (needVol <= 0 || currentVol >= targetPerBranch) {
      out.push(...list);
      return;
    }
    const scale = targetPerBranch / currentVol;
    list.forEach((a) => {
      const volPerUnit = productVolumeM3[a.product_id] ?? DEFAULT_VOLUME_M3;
      const newQty = Math.max(0, Math.round((a.suggested_qty || 0) * scale));
      out.push({ ...a, suggested_qty: newQty });
    });
  });
  return out;
}

/** Fallback: fill each branch to ~70% capacity when formula returns empty or very low volume. */
async function volumeBasedAllocation(conn, branchIds, productIds, carCapacityM3) {
  const ids = Array.isArray(productIds) && productIds.length > 0 ? productIds : null;
  const [rows] = ids
    ? await conn.execute(
        `SELECT product_id, width_cm, height_cm, length_cm FROM product WHERE is_active = 1 AND product_id IN (${ids.map(() => '?').join(',')}) ORDER BY product_id`,
        ids
      )
    : await conn.execute(
        'SELECT product_id, width_cm, height_cm, length_cm FROM product WHERE is_active = 1 ORDER BY product_id'
      );
  const products = (rows || []).map((r) => {
    const w = parseFloat(r.width_cm) || 0;
    const h = parseFloat(r.height_cm) || 0;
    const l = parseFloat(r.length_cm) || 0;
    const vol = w && h && l ? (w * h * l) / 1e6 : DEFAULT_VOLUME_M3;
    return { product_id: r.product_id, volume_m3: vol };
  });
  if (products.length === 0) return null;
  const targetPerBranch = carCapacityM3 * TARGET_CAPACITY_PCT;
  const volPerProduct = targetPerBranch / products.length;
  const allocations = [];
  branchIds.forEach((branchId) => {
    products.forEach((p) => {
      const qty = Math.max(1, Math.round(volPerProduct / p.volume_m3));
      allocations.push({ branch_id: branchId, product_id: p.product_id, suggested_qty: qty, avg_sales_7d: 0, current_stock: 0 });
    });
  });
  return { allocations };
}

// POST /api/allocations/calculate - OpenClaw method targeting ~70% car capacity; fallback to formula; scale or volume-fill so used is not tiny
app.post('/api/allocations/calculate', async (req, res) => {
  const branchIds = Array.isArray(req.body.branch_ids) ? req.body.branch_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  const productIds = Array.isArray(req.body.product_ids) ? req.body.product_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  const carCapacityM3 = typeof req.body.car_capacity_m3 === 'number' && req.body.car_capacity_m3 > 0
    ? req.body.car_capacity_m3
    : (parseFloat(req.body.car_capacity_m3) || DEFAULT_CAR_CAPACITY_M3);
  if (branchIds.length === 0) return res.status(400).json({ error: 'branch_ids array required' });
  let conn;
  try {
    conn = await getV2Conn();
    const productVolumeM3 = await getProductsWithVolume(conn, productIds.length > 0 ? productIds : null);
    await conn.release();
    conn = null;

    let data = await tryOpenClawAllocation(branchIds, productIds, carCapacityM3);
    if (!data || !data.allocations?.length) {
      data = await runAllocationCalculation(branchIds, productIds);
    }
    if (!data || !data.allocations?.length) {
      conn = await getV2Conn();
      data = await volumeBasedAllocation(conn, branchIds, productIds.length > 0 ? productIds : null, carCapacityM3);
      if (conn) await conn.release();
      conn = null;
    }
    if (data?.allocations?.length && Object.keys(productVolumeM3).length > 0) {
      const targetPct = 0.7;
      const targetPerBranch = carCapacityM3 * targetPct;
      const byBranch = {};
      data.allocations.forEach((a) => {
        const bid = a.branch_id;
        if (!byBranch[bid]) byBranch[bid] = 0;
        byBranch[bid] += (productVolumeM3[a.product_id] ?? DEFAULT_VOLUME_M3) * (a.suggested_qty || 0);
      });
      const needsScale = branchIds.some((bid) => (byBranch[bid] || 0) < targetPerBranch * 0.4);
      if (needsScale) {
        data = { ...data, allocations: scaleAllocationsToTargetCapacity(data.allocations, productVolumeM3, branchIds, carCapacityM3, targetPct) };
      }
    }
    res.json(data || { allocations: [] });
  } catch (err) {
    console.error('Allocations calculate error:', err);
    if (conn) try { await conn.release(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calculate-allocation - legacy alias, same logic
app.post('/api/calculate-allocation', async (req, res) => {
  const branchIds = Array.isArray(req.body.branch_ids) ? req.body.branch_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  const productIds = Array.isArray(req.body.product_ids) ? req.body.product_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  if (branchIds.length === 0) return res.status(400).json({ error: 'branch_ids array required' });
  try {
    const data = await runAllocationCalculation(branchIds, productIds);
    res.json(data);
  } catch (err) {
    console.error('Calculate allocation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/create-shipment - transaction: shipment -> orders -> order_items (Buddy System: driver + sales per vehicle)
app.post('/api/create-shipment', async (req, res) => {
  const { route_id, main_car_id, main_driver_emp_id, main_sales_emp_id, dc_assignments, orders: ordersPayload } = req.body || {};
  if (!route_id || !main_car_id || !main_driver_emp_id || !main_sales_emp_id || !Array.isArray(ordersPayload) || ordersPayload.length === 0) {
    return res.status(400).json({
      error: 'Missing required: route_id, main_car_id, main_driver_emp_id, main_sales_emp_id, and non-empty orders array (each with customer_branch_id, items)',
    });
  }
  const routeId = parseInt(route_id, 10);
  const mainCarId = parseInt(main_car_id, 10);
  const mainDriverId = parseInt(main_driver_emp_id, 10);
  const mainSalesId = parseInt(main_sales_emp_id, 10);
  if (isNaN(routeId) || isNaN(mainCarId) || isNaN(mainDriverId) || isNaN(mainSalesId)) {
    return res.status(400).json({ error: 'Invalid route_id, main_car_id, main_driver_emp_id, or main_sales_emp_id' });
  }
  if (mainDriverId === mainSalesId) {
    return res.status(400).json({ error: 'Driver and Sales must be different people (Buddy System)' });
  }
  const dcMap = (Array.isArray(dc_assignments) ? dc_assignments : []).reduce((acc, a) => {
    const dcId = a.dc_branch_id != null ? parseInt(a.dc_branch_id, 10) : null;
    if (!isNaN(dcId)) {
      const driverId = a.driver_emp_id != null ? parseInt(a.driver_emp_id, 10) : null;
      const salesId = a.sales_emp_id != null ? parseInt(a.sales_emp_id, 10) : null;
      if (driverId != null && salesId != null && driverId === salesId) {
        return acc;
      }
      acc[dcId] = {
        local_car_id: a.local_car_id != null ? parseInt(a.local_car_id, 10) : null,
        driver_emp_id: driverId,
        sales_emp_id: salesId,
      };
    }
    return acc;
  }, {});
  for (const a of Array.isArray(dc_assignments) ? dc_assignments : []) {
    const dcId = a.dc_branch_id != null ? parseInt(a.dc_branch_id, 10) : null;
    if (isNaN(dcId)) continue;
    const driverId = a.driver_emp_id != null ? parseInt(a.driver_emp_id, 10) : null;
    const salesId = a.sales_emp_id != null ? parseInt(a.sales_emp_id, 10) : null;
    if (driverId != null && salesId != null && driverId === salesId) {
      return res.status(400).json({ error: `DC ${dcId}: Driver and Sales must be different people (Buddy System)` });
    }
  }
  const orders = ordersPayload.map((o) => ({
    customer_branch_id: parseInt(o.customer_branch_id, 10),
    items: Array.isArray(o.items) ? o.items.filter((i) => i.product_id && (i.requested_qty || 0) > 0).map((i) => ({ product_id: parseInt(i.product_id, 10), requested_qty: parseInt(i.requested_qty, 10) || 0 })) : [],
  })).filter((o) => !isNaN(o.customer_branch_id) && o.items.length > 0);
  if (orders.length === 0) return res.status(400).json({ error: 'No valid orders with at least one item' });
  let conn;
  try {
    conn = await getV2Conn();
    await conn.beginTransaction();
    const shipmentCode = `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const [shipResult] = await conn.execute(
      `INSERT INTO shipments (shipment_code, route_id, car_id, driver_emp_id, sales_emp_id, status) VALUES (?, ?, ?, ?, ?, 'PLANNING')`,
      [shipmentCode, routeId, mainCarId, mainDriverId, mainSalesId]
    );
    const shipmentId = shipResult.insertId;
      for (const ord of orders) {
      const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const [orderResult] = await conn.execute(
        `INSERT INTO orders (order_code, customer_branch_id, shipment_id, status) VALUES (?, ?, ?, 'PLANNED')`,
        [orderCode, ord.customer_branch_id, shipmentId]
      );
      const orderId = orderResult.insertId;
      for (const it of ord.items) {
        if (isNaN(it.product_id) || it.requested_qty < 1) continue;
        const [[priceRow]] = await conn.execute('SELECT unit_price FROM product WHERE product_id = ?', [it.product_id]);
        const unitPrice = priceRow?.unit_price != null ? parseFloat(priceRow.unit_price) : 0;
        await conn.execute(
          `INSERT INTO order_items (order_id, product_id, requested_qty, unit_price_at_order, fulfilled_qty) VALUES (?, ?, ?, ?, 0)`,
          [orderId, it.product_id, it.requested_qty, unitPrice]
        );
      }
    }
    // DC → local: save in same transaction so DB has both manu→DC and DC→local
    for (const a of Array.isArray(dc_assignments) ? dc_assignments : []) {
      const dcId = a.dc_branch_id != null ? parseInt(a.dc_branch_id, 10) : null;
      if (isNaN(dcId)) continue;
      const localCarId = a.local_car_id != null ? parseInt(a.local_car_id, 10) : null;
      const driverId = a.driver_emp_id != null ? parseInt(a.driver_emp_id, 10) : null;
      const salesId = a.sales_emp_id != null ? parseInt(a.sales_emp_id, 10) : null;
      await conn.execute(
        `INSERT INTO shipment_dc_assignment (shipment_id, dc_branch_id, local_car_id, driver_emp_id, sales_emp_id) VALUES (?, ?, ?, ?, ?)`,
        [shipmentId, dcId, localCarId, driverId, salesId]
      );
    }
    await conn.commit();
    await conn.release();
    conn = null;
    res.status(201).json({ shipment_id: shipmentId, shipment_code: shipmentCode, success: true });
  } catch (err) {
    console.error('Create shipment error:', err);
    if (conn) try { await conn.rollback(); await conn.release(); } catch (_) {}
    res.status(500).json({ error: err.message || 'Failed to create shipment' });
  }
});

// GET /api/v2/radar/branches - Branches with lat/lng for map
app.get('/api/v2/radar/branches', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute(
      `SELECT branch_id, name, latitude, longitude FROM branch
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
    );
    await conn.release();
    res.json((rows || []).map((r) => ({
      branch_id: r.branch_id,
      name: r.name ?? '',
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
    })));
  } catch (err) {
    console.error('V2 radar branches error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/radar/cars - Shipments grouped as "cars" with route, orders, branch coords for Route Radar map
app.get('/api/v2/radar/cars', async (_req, res) => {
  try {
    const conn = await getV2Conn();
    const [shipRows] = await conn.execute(
      `SELECT s.shipment_id, s.shipment_code, s.status AS shipment_status, s.route_id,
        c.car_id, c.license_plate, c.type_id,
        t.name AS vehicle_type_name,
        CONCAT(e.firstname, ' ', e.lastname) AS driver_name
       FROM shipments s
       JOIN cars c ON s.car_id = c.car_id
       LEFT JOIN car_type t ON c.type_id = t.type_id
       JOIN employees e ON s.driver_emp_id = e.emp_id
       LEFT JOIN routes r ON s.route_id = r.route_id
       WHERE s.status IN ('PLANNING', 'LOADING', 'IN_TRANSIT', 'COMPLETED')
       ORDER BY s.shipment_id DESC`
    );
    const cars = [];
    for (const ship of shipRows || []) {
      const [orderRows] = await conn.execute(
        `SELECT o.order_id, o.order_code, o.status AS order_status, o.customer_branch_id,
          b.name AS branch_name, b.latitude, b.longitude
         FROM orders o
         JOIN branch b ON o.customer_branch_id = b.branch_id
         WHERE o.shipment_id = ?`,
        [ship.shipment_id]
      );
      let routeStops = [];
      if (ship.route_id) {
        const [stopRows] = await conn.execute(
          `SELECT rs.branch_id, rs.stop_sequence, b.name AS branch_name, b.latitude, b.longitude
           FROM route_stops rs
           JOIN branch b ON rs.branch_id = b.branch_id
           WHERE rs.route_id = ? AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
           ORDER BY rs.stop_sequence`,
          [ship.route_id]
        );
        routeStops = (stopRows || []).map((r) => ({
          branch_id: r.branch_id,
          stop_sequence: r.stop_sequence,
          branch_name: r.branch_name ?? '',
          latitude: parseFloat(r.latitude),
          longitude: parseFloat(r.longitude),
        }));
      }
      const orders = (orderRows || []).map((r) => ({
        order_id: r.order_id,
        order_code: r.order_code,
        order_status: r.order_status,
        customer_branch_id: r.customer_branch_id,
        branch_name: r.branch_name ?? '',
        latitude: r.latitude != null ? parseFloat(r.latitude) : null,
        longitude: r.longitude != null ? parseFloat(r.longitude) : null,
      })).filter((o) => o.latitude != null && o.longitude != null);
      cars.push({
        shipment_id: ship.shipment_id,
        shipment_code: ship.shipment_code,
        status: ship.shipment_status,
        route_id: ship.route_id,
        car_id: ship.car_id,
        license_plate: ship.license_plate ?? '',
        driver_name: ship.driver_name ?? '',
        type_id: ship.type_id ?? null,
        vehicle_type_name: ship.vehicle_type_name ?? null,
        orders,
        route_stops: routeStops,
      });
    }
    await conn.release();
    res.json({ cars });
  } catch (err) {
    console.error('V2 radar cars error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/shipments/:id/status - Update shipment status (LOADING, IN_TRANSIT, COMPLETED)
app.patch('/api/v2/shipments/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status: newStatus } = req.body || {};
  const allowed = ['LOADING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'];
  if (isNaN(id) || !allowed.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid shipment id or status. Use: ' + allowed.join(', ') });
  }
  try {
    const conn = await getV2Conn();
    const [rows] = await conn.execute('SELECT shipment_id FROM shipments WHERE shipment_id = ?', [id]);
    if (!rows || rows.length === 0) {
      await conn.release();
      return res.status(404).json({ error: 'Shipment not found' });
    }
    if (newStatus === 'IN_TRANSIT') {
      await conn.execute(
        "UPDATE shipments SET status = 'IN_TRANSIT', departure_time = NOW() WHERE shipment_id = ?",
        [id]
      );
      await conn.execute(
        "UPDATE orders SET status = 'LOADED' WHERE shipment_id = ?",
        [id]
      );
    } else {
      await conn.execute('UPDATE shipments SET status = ? WHERE shipment_id = ?', [newStatus, id]);
    }
    await conn.release();
    res.json({ shipment_id: id, status: newStatus, success: true });
  } catch (err) {
    console.error('V2 shipment status update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/shipments/:id/debug/advance - Debug helper to auto-advance process (PLANNING/LOADING -> IN_TRANSIT) or complete it.
// Body: { mode: 'to_in_transit' | 'complete' }
app.post('/api/v2/shipments/:id/debug/advance', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const mode = (req.body && req.body.mode) ? String(req.body.mode) : 'to_in_transit';
  const allowedModes = ['to_in_transit', 'complete'];
  if (isNaN(id) || !allowedModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid shipment id or mode. Use: ' + allowedModes.join(', ') });
  }
  let conn;
  try {
    conn = await getV2Conn();
    await conn.beginTransaction();
    const [shipRows] = await conn.execute(
      'SELECT shipment_id, status FROM shipments WHERE shipment_id = ? FOR UPDATE',
      [id]
    );
    if (!shipRows || shipRows.length === 0) {
      await conn.rollback();
      await conn.release();
      return res.status(404).json({ error: 'Shipment not found' });
    }

    if (mode === 'complete') {
      await conn.execute(
        "UPDATE shipments SET status = 'COMPLETED' WHERE shipment_id = ?",
        [id]
      );
      await conn.execute(
        "UPDATE orders SET status = 'DELIVERED' WHERE shipment_id = ?",
        [id]
      );
    } else {
      // mode === 'to_in_transit'
      await conn.execute(
        "UPDATE shipments SET status = 'IN_TRANSIT', departure_time = COALESCE(departure_time, NOW()) WHERE shipment_id = ?",
        [id]
      );
      await conn.execute(
        "UPDATE orders SET status = 'LOADED' WHERE shipment_id = ? AND status != 'DELIVERED'",
        [id]
      );
    }

    await conn.commit();
    await conn.release();
    res.json({ shipment_id: id, mode, success: true });
  } catch (err) {
    console.error('V2 debug advance error:', err);
    if (conn) try { await conn.rollback(); await conn.release(); } catch (_) {}
    res.status(500).json({ error: err.message || 'Failed to advance shipment' });
  }
});

const SYSTEM_PROMPT =
  'You are a Farmhouse Logistic assistant. You have access to the bread_logistics database via db_query (run SELECT) and db_schema (see tables). Help users by answering questions about shipments, orders, and logistics data. Be concise and business-focused.';

// Proxy chat to OpenClaw (dev fallback when unreachable)
app.post('/api/chat', async (req, res) => {
  const { message, messages: messageHistory, stream } = req.body;
  const messages = messageHistory || [{ role: 'user', content: message || 'Hello' }];
  const systemPrompt = { role: 'system', content: SYSTEM_PROMPT };
  const allMessages = [systemPrompt, ...messages];
  const isDev = process.env.NODE_ENV !== 'production';

  if (!OPENCLAW_TOKEN && isDev) {
    const lastMsg = messages[messages.length - 1]?.content || '';
    return res.json({
      content: `[Dev mode – OpenClaw token not set]\n\nYou asked: "${lastMsg}"\n\nTo use real AI: add OPENCLAW_GATEWAY_TOKEN to .env, start the OpenClaw gateway (port 18789), and set NODE_ENV=production.`,
      usage: null,
    });
  }

  if (!OPENCLAW_TOKEN) {
    return res.status(500).json({
      error: 'OPENCLAW_GATEWAY_TOKEN is required. Add it to .env.',
    });
  }

  try {
    const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages: allMessages,
        stream: stream || false,
        user: 'web',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText || response.statusText;
      if (response.status === 401) {
        errMsg =
          'OpenClaw token invalid. Check OPENCLAW_GATEWAY_TOKEN in .env matches your gateway config.';
      } else {
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error?.message || parsed.message || errMsg;
        } catch {}
      }
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    res.json({ content, usage: data.usage });
  } catch (err) {
    console.error('OpenClaw error:', err);
    if (isDev) {
      const lastMsg = messages[messages.length - 1]?.content || '';
      return res.json({
        content: `[Dev mode – OpenClaw not running]\n\nYou asked: "${lastMsg}"\n\nTo use real AI: start the OpenClaw gateway (port 18789) and set NODE_ENV=production.`,
        usage: null,
      });
    }
    res.status(500).json({
      error: err.message || 'Failed to reach OpenClaw. Is the gateway running?',
    });
  }
});

// Legacy route-radar (plain JS from logistic_OS) — served so /route-radar and /route-radar.js work
const legacyDir = path.join(__dirname, 'legacy');
app.get('/route-radar', (_req, res) => {
  res.sendFile(path.join(legacyDir, 'route-radar.html'));
});
app.get('/route-radar.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(legacyDir, 'route-radar.js'));
});

// Serve React build in production (regex catch-all avoids path-to-regexp v7 '*' issues)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`API server running at http://${HOST}:${PORT}`);
  console.log(`DB: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log('Ensure OpenClaw gateway is running for AI (port 18789).');
});
