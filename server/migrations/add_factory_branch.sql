-- เพิ่มโรงงาน (Factory) และประเภทสาขาใน bread_logistics_v2 ถ้ายังไม่มี
-- Run: mysql -u root -p bread_logistics_v2 < server/migrations/add_factory_branch.sql

-- ประเภทสาขา (ถ้ามีอยู่แล้วจะไม่ซ้ำเพราะ INSERT IGNORE / หรือใช้ REPLACE ตามที่ DB รองรับ)
INSERT IGNORE INTO branch_category (cat_id, name, description) VALUES
  (1, 'Factory', 'โรงงาน'),
  (2, 'Distribution Center', 'ศูนย์กระจายสินค้า'),
  (3, 'Retailer', 'ร้านค้า');

-- โรงงาน 1 แห่ง (กรุงเทพ) — แก้ latitude/longitude ได้ตามจริง
INSERT INTO branch (name, cat_id, latitude, longitude, parent_branch_id)
SELECT 'Factory', 1, 13.7563, 100.5018, NULL
FROM (SELECT 1) x
WHERE NOT EXISTS (SELECT 1 FROM branch b WHERE b.cat_id = 1);
