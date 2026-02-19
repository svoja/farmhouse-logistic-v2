import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
const PORT = process.env.PORT || 3002;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'logistic_standalone',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
pool.on('error', (err) => console.error('MySQL pool error:', err.message));

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

async function getConn() {
  return pool.getConnection();
}

// ----- Routes -----

app.get('/api/routes', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT route_id, name, description FROM routes ORDER BY name');
    res.json(rows || []);
  } catch (e) {
    console.error('GET /api/routes', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/route-stops/:routeId', async (req, res) => {
  const routeId = parseInt(req.params.routeId, 10);
  if (isNaN(routeId)) return res.status(400).json({ error: 'Invalid route_id' });
  try {
    const [rows] = await pool.execute(
      `SELECT rs.stop_id, rs.route_id, rs.branch_id, rs.stop_sequence, rs.estimated_travel_min,
        b.name AS branch_name, b.cat_id
       FROM route_stops rs
       JOIN branch b ON rs.branch_id = b.branch_id
       WHERE rs.route_id = ?
       ORDER BY rs.stop_sequence`,
      [routeId]
    );
    res.json(rows || []);
  } catch (e) {
    console.error('GET /api/route-stops', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/cars', async (req, res) => {
  const available = req.query.available === '1' || req.query.available === 'true';
  const typeFilter = (req.query.type || '').toLowerCase();
  try {
    let sql = `SELECT c.car_id, c.license_plate, c.type_id, c.status,
        t.name AS type_name, t.max_load_weight_kg, t.max_load_volume_m3
       FROM cars c
       JOIN car_type t ON c.type_id = t.type_id`;
    if (available) {
      sql += ` WHERE c.car_id NOT IN (
        SELECT s.car_id FROM shipments s WHERE s.status IN ('PLANNING', 'LOADING', 'IN_TRANSIT')
      )`;
    }
    sql += ' ORDER BY c.car_id';
    const [rows] = await pool.execute(sql);
    let list = rows || [];
    if (typeFilter) list = list.filter((r) => (r.type_name || '').toLowerCase().includes(typeFilter));
    res.json(list);
  } catch (e) {
    console.error('GET /api/cars', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/employees', async (req, res) => {
  const jobTitle = (req.query.job_title || '').trim().toLowerCase();
  try {
    let sql = `SELECT e.emp_id, e.firstname, e.lastname, e.job_id, j.title AS job_title,
      CONCAT(e.firstname, ' ', e.lastname) AS full_name
      FROM employees e
      JOIN job_description j ON e.job_id = j.job_id
      WHERE e.is_active = 1`;
    const params = [];
    if (jobTitle) {
      sql += ' AND LOWER(j.title) LIKE ?';
      params.push(`%${jobTitle}%`);
    }
    sql += ' ORDER BY e.firstname, e.lastname';
    const [rows] = await pool.execute(sql, params);
    res.json(rows || []);
  } catch (e) {
    console.error('GET /api/employees', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT product_id, name, unit_price, is_active FROM product WHERE is_active = 1 ORDER BY name'
    );
    res.json(rows || []);
  } catch (e) {
    console.error('GET /api/products', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/branch-categories', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT cat_id, name, description FROM branch_category ORDER BY cat_id');
    res.json(rows || []);
  } catch (e) {
    console.error('GET /api/branch-categories', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

app.get('/api/branches/:branchId/retailers', async (req, res) => {
  const branchId = parseInt(req.params.branchId, 10);
  if (isNaN(branchId)) return res.status(400).json({ error: 'Invalid branch_id' });
  try {
    const [rows] = await pool.execute(
      `SELECT branch_id, name, cat_id, parent_branch_id
       FROM branch WHERE parent_branch_id = ? AND cat_id = 3 ORDER BY name`,
      [branchId]
    );
    res.json((rows || []).map((r) => ({ branch_id: r.branch_id, name: r.name, branch_name: r.name, cat_id: r.cat_id, parent_branch_id: r.parent_branch_id })));
  } catch (e) {
    console.error('GET /api/branches/:branchId/retailers', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/allocations/calculate - simple formula: distribute by branch count, cap by capacity
const DEFAULT_CAR_CAPACITY_M3 = 12;
app.post('/api/allocations/calculate', async (req, res) => {
  const branchIds = Array.isArray(req.body.branch_ids) ? req.body.branch_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  const productIds = Array.isArray(req.body.product_ids) ? req.body.product_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)) : [];
  const carCapacityM3 = typeof req.body.car_capacity_m3 === 'number' && req.body.car_capacity_m3 > 0
    ? req.body.car_capacity_m3
    : (parseFloat(req.body.car_capacity_m3) || DEFAULT_CAR_CAPACITY_M3);
  if (branchIds.length === 0) return res.status(400).json({ error: 'branch_ids array required' });
  try {
    const useProducts = productIds.length > 0 ? productIds : null;
    let productList = useProducts;
    if (!productList || productList.length === 0) {
      const [pRows] = await pool.execute('SELECT product_id FROM product WHERE is_active = 1');
      productList = (pRows || []).map((r) => r.product_id);
    }
    const perBranch = Math.max(1, Math.floor((carCapacityM3 * 0.7 * 100) / (branchIds.length * Math.max(1, productList.length))));
    const allocations = [];
    for (const branchId of branchIds) {
      for (const productId of productList) {
        allocations.push({ branch_id: branchId, product_id: productId, suggested_qty: perBranch });
      }
    }
    res.json({ allocations });
  } catch (e) {
    console.error('POST /api/allocations/calculate', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/shipments - create shipment + orders + order_items + shipment_dc_assignment
app.post('/api/shipments', async (req, res) => {
  const { route_id, main_car_id, main_driver_emp_id, main_sales_emp_id, dc_assignments, orders: ordersPayload } = req.body || {};
  if (!route_id || !main_car_id || !main_driver_emp_id || !main_sales_emp_id || !Array.isArray(ordersPayload) || ordersPayload.length === 0) {
    return res.status(400).json({
      error: 'Missing required: route_id, main_car_id, main_driver_emp_id, main_sales_emp_id, and non-empty orders array',
    });
  }
  const routeId = parseInt(route_id, 10);
  const mainCarId = parseInt(main_car_id, 10);
  const mainDriverId = parseInt(main_driver_emp_id, 10);
  const mainSalesId = parseInt(main_sales_emp_id, 10);
  if (isNaN(routeId) || isNaN(mainCarId) || isNaN(mainDriverId) || isNaN(mainSalesId)) {
    return res.status(400).json({ error: 'Invalid ids' });
  }
  if (mainDriverId === mainSalesId) return res.status(400).json({ error: 'Driver and Sales must be different (Buddy System)' });
  const orders = ordersPayload
    .map((o) => ({
      customer_branch_id: parseInt(o.customer_branch_id, 10),
      items: Array.isArray(o.items) ? o.items.filter((i) => i.product_id && (i.requested_qty || 0) > 0).map((i) => ({ product_id: parseInt(i.product_id, 10), requested_qty: parseInt(i.requested_qty, 10) || 0 })) : [],
    }))
    .filter((o) => !isNaN(o.customer_branch_id) && o.items.length > 0);
  if (orders.length === 0) return res.status(400).json({ error: 'No valid orders with items' });
  const dcList = Array.isArray(dc_assignments) ? dc_assignments : [];
  let conn;
  try {
    conn = await getConn();
    await conn.beginTransaction();
    const shipmentCode = `SHP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`;
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
    for (const a of dcList) {
      const dcId = a.dc_branch_id != null ? parseInt(a.dc_branch_id, 10) : null;
      if (isNaN(dcId)) continue;
      const localCarId = a.local_car_id != null ? parseInt(a.local_car_id, 10) : null;
      const driverId = a.driver_emp_id != null ? parseInt(a.driver_emp_id, 10) : null;
      const salesId = a.sales_emp_id != null ? parseInt(a.sales_emp_id, 10) : null;
      try {
        await conn.execute(
          `INSERT INTO shipment_dc_assignment (shipment_id, dc_branch_id, local_car_id, driver_emp_id, sales_emp_id) VALUES (?, ?, ?, ?, ?)`,
          [shipmentId, dcId, localCarId, driverId, salesId]
        );
      } catch (_) {}
    }
    await conn.commit();
    conn.release();
    res.status(201).json({ shipment_id: shipmentId, shipment_code: shipmentCode, success: true });
  } catch (e) {
    if (conn) try { await conn.rollback(); conn.release(); } catch (_) {}
    console.error('POST /api/shipments', e?.message);
    res.status(500).json({ error: e?.message || 'Failed to create shipment' });
  }
});

// GET /api/map/branches - all branches with lat/lng
app.get('/api/map/branches', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT branch_id, name, cat_id, latitude, longitude FROM branch WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
    );
    res.json((rows || []).map((r) => ({
      branch_id: r.branch_id,
      name: r.name ?? '',
      cat_id: r.cat_id,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
    })));
  } catch (e) {
    console.error('GET /api/map/branches', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// GET /api/map/by-car - cars with orders/stops for map (Factory -> DC -> back; local: DC -> retailers)
const FACTORY_CAT_ID = 1;
const DC_CAT_ID = 2;
app.get('/api/map/by-car', async (_req, res) => {
  try {
    const conn = await getConn();
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
          driver_name: ship.driver_name ?? '',
        });
        if (factoryRow) {
          orders.push(toOrder(factoryRow, 'Factory'));
          for (const dc of dcRows) orders.push(toOrder(dc, 'DC'));
          if (dcRows.length > 0) orders.push(toOrder(factoryRow, 'Factory'));
        } else if (dcRows.length > 0) {
          const [[fb]] = await conn.execute(
            `SELECT branch_id, name, latitude, longitude FROM branch WHERE cat_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 1`,
            [FACTORY_CAT_ID]
          );
          if (fb) {
            orders.push({ order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: fb.name ?? 'Factory', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), driver_name: ship.driver_name ?? '' });
            for (const dc of dcRows) orders.push(toOrder(dc, 'DC'));
            orders.push({ order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: (fb.name ?? 'Factory') + ' (กลับ)', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), driver_name: ship.driver_name ?? '' });
          }
        }
      }
      if (orders.length === 0) {
        const [[fb]] = await conn.execute(
          `SELECT branch_id, name, latitude, longitude FROM branch WHERE cat_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 1`,
          [FACTORY_CAT_ID]
        );
        if (fb) {
          const f = { order_id: 0, car_id: ship.car_id, delivery_status: 'pending', branch_id: fb.branch_id, branch_name: fb.name ?? 'Factory', branch_latitude: parseFloat(fb.latitude), branch_longitude: parseFloat(fb.longitude), driver_name: ship.driver_name ?? '' };
          orders = [f, f];
        }
      }
      if (String(ship.shipment_status) === 'IN_TRANSIT' && orders.length > 0) {
        const idx = orders.findIndex((o) => o.delivery_status !== 'delivered');
        if (idx >= 0) orders = orders.map((o, i) => (i === idx ? { ...o, delivery_status: 'in_transit' } : o));
      }
      if (orders.length > 0) {
        cars.push({
          car_id: ship.car_id,
          license_plate: ship.license_plate ?? '',
          status: ship.shipment_status,
          cars_type_name: ship.cars_type_name ?? '',
          orders,
        });
      }
    }
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
            `SELECT c.car_id, c.license_plate, t.name AS cars_type_name FROM cars c LEFT JOIN car_type t ON c.type_id = t.type_id WHERE c.car_id = ?`,
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
          const [retailerRows] = await conn.execute(
            `SELECT branch_id FROM branch WHERE parent_branch_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
            [dc.dc_branch_id]
          );
          const rids = (retailerRows || []).map((r) => r.branch_id);
          if (rids.length === 0) continue;
          const rPh = rids.map(() => '?').join(',');
          const [orderRows] = await conn.execute(
            `SELECT o.order_id, o.customer_branch_id, o.status AS order_status, b.name AS branch_name, b.latitude, b.longitude
             FROM orders o JOIN branch b ON o.customer_branch_id = b.branch_id
             WHERE o.shipment_id = ? AND o.customer_branch_id IN (${rPh}) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL`,
            [dc.shipment_id, ...rids]
          );
          const dcStop = {
            order_id: 0,
            car_id: dc.local_car_id,
            delivery_status: 'loaded',
            branch_id: dcBranch.branch_id,
            branch_name: dcBranch.name ?? 'DC',
            branch_latitude: parseFloat(dcBranch.latitude),
            branch_longitude: parseFloat(dcBranch.longitude),
            driver_name: driverName,
          };
          let locOrders = (orderRows || []).map((o) => ({
            order_id: o.order_id,
            car_id: dc.local_car_id,
            delivery_status: o.order_status === 'DELIVERED' ? 'delivered' : o.order_status === 'LOADED' ? 'loaded' : o.order_status === 'PLANNED' ? 'pending' : 'in_transit',
            branch_id: o.customer_branch_id,
            branch_name: o.branch_name ?? '',
            branch_latitude: parseFloat(o.latitude),
            branch_longitude: parseFloat(o.longitude),
            driver_name: driverName,
          }));
          locOrders = [dcStop, ...locOrders];
          if (String(ship.shipment_status) === 'IN_TRANSIT' && locOrders.length > 0) {
            const idx = locOrders.findIndex((o) => o.delivery_status !== 'delivered');
            if (idx >= 0) locOrders = locOrders.map((o, i) => (i === idx ? { ...o, delivery_status: 'in_transit' } : o));
          }
          if (locOrders.length > 0) {
            cars.push({
              car_id: dc.local_car_id,
              license_plate: carInfo.license_plate ?? '',
              status: ship.shipment_status,
              cars_type_name: carInfo.cars_type_name ?? '',
              orders: locOrders,
            });
          }
        }
      } catch (dcErr) {
        if (!String(dcErr?.message || '').includes("doesn't exist")) console.error('By-car DC:', dcErr?.message);
      }
    }
    conn.release();
    res.json({ cars });
  } catch (e) {
    console.error('GET /api/map/by-car', e?.message);
    res.json({ cars: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Logistic Standalone API at http://localhost:${PORT}`);
});
