-- เคลียร์และจำลองข้อมูล Manu -> DC -> Retailer (bread_logistics_v2)
-- ใช้ได้กับ DB ที่มีตาราง branch, routes, route_stops, cars, car_type, employees, job_description, product, shipments, orders, order_items, shipment_dc_assignment, branch_category
-- ถ้ายังไม่มีตาราง shipment_dc_assignment ให้รัน add_shipment_dc_assignment.sql ก่อน
-- Run: mysql -u root -p bread_logistics_v2 < server/migrations/seed_manu_dc_retailer.sql

SET FOREIGN_KEY_CHECKS = 0;

-- ลบข้อมูล (ปิด FK แล้วลบลำดับไหนก็ได้)
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM shipment_dc_assignment;
DELETE FROM shipments;
DELETE FROM route_stops;
-- branch มี FK ตัวเอง (parent_branch_id -> branch_id) บาง client ไม่เคารพ FOREIGN_KEY_CHECKS จึงลบลูกก่อน
DELETE FROM branch WHERE parent_branch_id IS NOT NULL;
DELETE FROM branch;
DELETE FROM routes;

-- ประเภทสาขา
INSERT INTO branch_category (cat_id, name, description) VALUES
  (1, 'Factory', 'โรงงาน (Manu)'),
  (2, 'Distribution Center', 'ศูนย์กระจายสินค้า (DC)'),
  (3, 'Retailer', 'ร้านค้า')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- สาขา: โรงงาน (กรุงเทพ) -> DC (นครสวรรค์) -> ร้าน 2 แห่ง (ใต้ DC)
INSERT INTO branch (branch_id, name, cat_id, latitude, longitude, parent_branch_id) VALUES
  (1, 'Manu (โรงงาน)', 1, 13.7563, 100.5018, NULL),
  (2, 'DC นครสวรรค์', 2, 15.7042, 100.1372, NULL),
  (3, 'ร้าน A', 3, 15.7200, 100.1500, 2),
  (4, 'ร้าน B', 3, 15.7100, 100.1300, 2);

-- Route เดียว: โรงงาน -> DC (รถใหญ่); รถเล็กส่งจาก DC ไปร้าน
INSERT INTO routes (route_id, name, description) VALUES
  (1, 'Route Manu-DC-Retailer', 'จำลอง โรงงาน -> DC -> ร้านค้า');

-- จุดหยุดของ route: โรงงาน (1) แล้วไป DC (2) — ร้านไม่ใส่ใน route_stops (รถเล็กส่งจาก DC)
INSERT INTO route_stops (route_id, branch_id, stop_sequence, estimated_travel_min) VALUES
  (1, 1, 1, 0),
  (1, 2, 2, 180);

-- ประเภทรถ และรถ (ถ้ายังไม่มี)
INSERT IGNORE INTO car_type (type_id, name, max_load_weight_kg, max_load_volume_m3) VALUES
  (1, '4 Wheel Pickup', 1000, 5),
  (2, '10 Wheel Truck', 10000, 25);

INSERT IGNORE INTO cars (car_id, license_plate, type_id, status) VALUES
  (1, 'กข-1234', 2, 'AVAILABLE'),
  (2, 'กข-5678', 1, 'AVAILABLE');

-- งาน และพนักงาน (Driver / Sales สำหรับ Buddy System)
INSERT IGNORE INTO job_description (job_id, title) VALUES
  (1, 'Driver'),
  (2, 'Sales');

INSERT IGNORE INTO employees (emp_id, firstname, lastname, job_id, is_active) VALUES
  (1, 'สมชาย', 'ขับรถ', 1, 1),
  (2, 'สมหญิง', 'ขายของ', 2, 1),
  (3, 'วิชัย', 'ท้องถิ่น', 1, 1),
  (4, 'วิชุดา', 'ขายร้าน', 2, 1);

-- สินค้า (ให้มี product_id 1,2 เสมอ เพื่อให้ order_items อ้างอิงได้)
INSERT INTO product (product_id, name, unit_price, is_active) VALUES
  (1, 'ขนมปัง white', 25.00, 1),
  (2, 'ขนมปัง brown', 30.00, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), unit_price = VALUES(unit_price), is_active = VALUES(is_active);

-- (ตัวเลือก) สร้าง shipment จำลอง 1 รายการ + orders 2 ร้าน + DC assignment เพื่อให้ Route Radar มีข้อมูล
INSERT INTO shipments (shipment_code, route_id, car_id, driver_emp_id, sales_emp_id, status) VALUES
  ('SHP-DEMO-001', 1, 1, 1, 2, 'PLANNING');

SET @sid = LAST_INSERT_ID();

INSERT INTO orders (order_code, customer_branch_id, shipment_id, status) VALUES
  ('ORD-DEMO-1', 3, @sid, 'PLANNED'),
  ('ORD-DEMO-2', 4, @sid, 'PLANNED');

SET @oid1 = (SELECT order_id FROM orders WHERE shipment_id = @sid AND customer_branch_id = 3 LIMIT 1);
SET @oid2 = (SELECT order_id FROM orders WHERE shipment_id = @sid AND customer_branch_id = 4 LIMIT 1);

INSERT INTO order_items (order_id, product_id, requested_qty, unit_price_at_order, fulfilled_qty) VALUES
  (@oid1, 1, 10, 25.00, 0),
  (@oid1, 2, 5, 30.00, 0),
  (@oid2, 1, 8, 25.00, 0),
  (@oid2, 2, 4, 30.00, 0);

INSERT INTO shipment_dc_assignment (shipment_id, dc_branch_id, local_car_id, driver_emp_id, sales_emp_id) VALUES
  (@sid, 2, 2, 3, 4);

SET FOREIGN_KEY_CHECKS = 1;

-- สรุป: Manu (branch_id=1) -> DC (branch_id=2) -> ร้าน A (3), ร้าน B (4). Route 1 มี stop โรงงาน->DC. รถใหญ่ 1 รถเล็ก 2.
