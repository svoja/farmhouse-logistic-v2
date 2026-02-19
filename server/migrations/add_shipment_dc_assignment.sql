-- Store which local car (and driver/sales) is at each DC for a shipment.
-- Run this on bread_logistics_v2 so Route Radar can show both main truck and local cars.
CREATE TABLE IF NOT EXISTS shipment_dc_assignment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  dc_branch_id INT NOT NULL,
  local_car_id INT NULL,
  driver_emp_id INT NULL,
  sales_emp_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shipment_dc (shipment_id, dc_branch_id),
  KEY ix_shipment (shipment_id),
  KEY ix_dc (dc_branch_id)
);
