-- Seed data: Manu -> DC -> Retailers (run after schema.sql)
-- Run: mysql -u root -p logistic_standalone < server/db/seed.sql

USE logistic_standalone;

INSERT INTO branch_category (cat_id, name, description) VALUES
  (1, 'Factory', 'โรงงาน (Manu)'),
  (2, 'Distribution Center', 'ศูนย์กระจาย (DC)'),
  (3, 'Retailer', 'ร้านค้า')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

INSERT INTO branch (branch_id, name, cat_id, latitude, longitude, parent_branch_id) VALUES
  (1, 'Manu (โรงงาน)', 1, 13.7563, 100.5018, NULL),
  (2, 'DC นครสวรรค์', 2, 15.7042, 100.1372, NULL),
  (3, 'ร้าน A', 3, 15.7200, 100.1500, 2),
  (4, 'ร้าน B', 3, 15.7100, 100.1300, 2)
ON DUPLICATE KEY UPDATE name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), parent_branch_id = VALUES(parent_branch_id);

INSERT INTO routes (route_id, name, description) VALUES
  (1, 'Route Manu-DC-Retailer', 'จำลอง โรงงาน -> DC -> ร้านค้า')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

INSERT IGNORE INTO route_stops (route_id, branch_id, stop_sequence, estimated_travel_min) VALUES
  (1, 1, 1, 0),
  (1, 2, 2, 180);

INSERT IGNORE INTO car_type (type_id, name, max_load_weight_kg, max_load_volume_m3) VALUES
  (1, '4 Wheel Pickup', 1000, 5),
  (2, '10 Wheel Truck', 10000, 25);

INSERT INTO cars (car_id, license_plate, type_id, status) VALUES
  (1, 'กข-1234', 2, 'AVAILABLE'),
  (2, 'กข-5678', 1, 'AVAILABLE')
ON DUPLICATE KEY UPDATE license_plate = VALUES(license_plate), type_id = VALUES(type_id), status = VALUES(status);

INSERT IGNORE INTO job_description (job_id, title) VALUES
  (1, 'Driver'),
  (2, 'Sales');

INSERT INTO employees (emp_id, firstname, lastname, job_id, is_active) VALUES
  (1, 'สมชาย', 'ขับรถ', 1, 1),
  (2, 'สมหญิง', 'ขายของ', 2, 1),
  (3, 'วิชัย', 'ท้องถิ่น', 1, 1),
  (4, 'วิชุดา', 'ขายร้าน', 2, 1)
ON DUPLICATE KEY UPDATE firstname = VALUES(firstname), lastname = VALUES(lastname), job_id = VALUES(job_id), is_active = VALUES(is_active);

INSERT INTO product (product_id, name, unit_price, is_active) VALUES
  (1, 'ขนมปัง white', 25.00, 1),
  (2, 'ขนมปัง brown', 30.00, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), unit_price = VALUES(unit_price), is_active = VALUES(is_active);
