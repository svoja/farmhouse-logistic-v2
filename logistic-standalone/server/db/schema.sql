-- Logistic Standalone - Create database and tables
-- Run: mysql -u root -p < server/db/schema.sql

CREATE DATABASE IF NOT EXISTS logistic_standalone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE logistic_standalone;

-- Branch categories: 1=Factory, 2=DC, 3=Retailer
CREATE TABLE IF NOT EXISTS branch_category (
  cat_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL
);

-- Branches (factory, DC, retailers; retailers have parent_branch_id = DC)
CREATE TABLE IF NOT EXISTS branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cat_id INT NOT NULL,
  latitude DECIMAL(10, 7) DEFAULT NULL,
  longitude DECIMAL(10, 7) DEFAULT NULL,
  parent_branch_id INT DEFAULT NULL,
  CONSTRAINT fk_branch_parent FOREIGN KEY (parent_branch_id) REFERENCES branch (branch_id) ON DELETE SET NULL,
  CONSTRAINT fk_branch_cat FOREIGN KEY (cat_id) REFERENCES branch_category (cat_id)
);

-- Routes
CREATE TABLE IF NOT EXISTS routes (
  route_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500) DEFAULT NULL
);

-- Route stops (order: factory, then DCs)
CREATE TABLE IF NOT EXISTS route_stops (
  stop_id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  branch_id INT NOT NULL,
  stop_sequence INT NOT NULL DEFAULT 1,
  estimated_travel_min INT DEFAULT NULL,
  UNIQUE KEY uq_route_branch (route_id, branch_id),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES routes (route_id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_branch FOREIGN KEY (branch_id) REFERENCES branch (branch_id) ON DELETE CASCADE
);

-- Car types
CREATE TABLE IF NOT EXISTS car_type (
  type_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  max_load_weight_kg DECIMAL(10, 2) DEFAULT NULL,
  max_load_volume_m3 DECIMAL(10, 2) DEFAULT NULL
);

-- Cars
CREATE TABLE IF NOT EXISTS cars (
  car_id INT AUTO_INCREMENT PRIMARY KEY,
  license_plate VARCHAR(20) NOT NULL,
  type_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'AVAILABLE',
  CONSTRAINT fk_car_type FOREIGN KEY (type_id) REFERENCES car_type (type_id)
);

-- Job roles (Driver, Sales)
CREATE TABLE IF NOT EXISTS job_description (
  job_id INT PRIMARY KEY,
  title VARCHAR(100) NOT NULL
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  emp_id INT AUTO_INCREMENT PRIMARY KEY,
  firstname VARCHAR(100) NOT NULL,
  lastname VARCHAR(100) NOT NULL,
  job_id INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  CONSTRAINT fk_emp_job FOREIGN KEY (job_id) REFERENCES job_description (job_id)
);

-- Products
CREATE TABLE IF NOT EXISTS product (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  unit_price DECIMAL(12, 2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
);

-- Shipments (main truck: route, car, driver, sales)
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_code VARCHAR(50) NOT NULL UNIQUE,
  route_id INT NOT NULL,
  car_id INT NOT NULL,
  driver_emp_id INT NOT NULL,
  sales_emp_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'PLANNING',
  CONSTRAINT fk_ship_route FOREIGN KEY (route_id) REFERENCES routes (route_id),
  CONSTRAINT fk_ship_car FOREIGN KEY (car_id) REFERENCES cars (car_id),
  CONSTRAINT fk_ship_driver FOREIGN KEY (driver_emp_id) REFERENCES employees (emp_id),
  CONSTRAINT fk_ship_sales FOREIGN KEY (sales_emp_id) REFERENCES employees (emp_id)
);

-- Orders (per retailer branch)
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(50) NOT NULL,
  customer_branch_id INT NOT NULL,
  shipment_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'PLANNED',
  CONSTRAINT fk_order_branch FOREIGN KEY (customer_branch_id) REFERENCES branch (branch_id),
  CONSTRAINT fk_order_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (shipment_id) ON DELETE CASCADE
);

-- Order line items
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  requested_qty INT NOT NULL DEFAULT 0,
  unit_price_at_order DECIMAL(12, 2) DEFAULT 0,
  fulfilled_qty INT DEFAULT 0,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES product (product_id)
);

-- DC assignment (local car + driver/sales per DC)
CREATE TABLE IF NOT EXISTS shipment_dc_assignment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  dc_branch_id INT NOT NULL,
  local_car_id INT DEFAULT NULL,
  driver_emp_id INT DEFAULT NULL,
  sales_emp_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shipment_dc (shipment_id, dc_branch_id),
  CONSTRAINT fk_dca_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (shipment_id) ON DELETE CASCADE,
  CONSTRAINT fk_dca_dc FOREIGN KEY (dc_branch_id) REFERENCES branch (branch_id),
  CONSTRAINT fk_dca_car FOREIGN KEY (local_car_id) REFERENCES cars (car_id)
);
