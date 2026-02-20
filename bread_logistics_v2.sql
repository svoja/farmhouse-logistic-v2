-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20260217.15385298cd
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 19, 2026 at 06:51 PM
-- Server version: 9.6.0
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bread_logistics_v2`
--

-- --------------------------------------------------------

--
-- Table structure for table `box_size`
--

CREATE TABLE `box_size` (
  `box_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `width_cm` decimal(10,2) DEFAULT NULL,
  `length_cm` decimal(10,2) DEFAULT NULL,
  `height_cm` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `branch`
--

CREATE TABLE `branch` (
  `branch_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(18,15) DEFAULT NULL,
  `longitude` decimal(18,15) DEFAULT NULL,
  `shelf_space_sqm` int DEFAULT NULL,
  `cat_id` int NOT NULL,
  `parent_branch_id` int DEFAULT NULL,
  `manager_emp_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `branch`
--

INSERT INTO `branch` (`branch_id`, `name`, `latitude`, `longitude`, `shelf_space_sqm`, `cat_id`, `parent_branch_id`, `manager_emp_id`) VALUES
(1, 'Manu (โรงงาน)', 13.756300000000000, 100.501800000000000, NULL, 1, NULL, NULL),
(2, 'DC นครสวรรค์', 15.704200000000000, 100.137200000000000, NULL, 2, NULL, NULL),
(3, 'ร้าน A', 15.720000000000000, 100.150000000000000, NULL, 3, 2, NULL),
(4, 'ร้าน B', 15.710000000000000, 100.130000000000000, NULL, 3, 2, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `branch_category`
--

CREATE TABLE `branch_category` (
  `cat_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `branch_category`
--

INSERT INTO `branch_category` (`cat_id`, `name`, `description`) VALUES
(1, 'Factory', 'โรงงาน (Manu)'),
(2, 'Distribution Center', 'ศูนย์กระจายสินค้า (DC)'),
(3, 'Retailer', 'ร้านค้า');

-- --------------------------------------------------------

--
-- Table structure for table `branch_insights`
--

CREATE TABLE `branch_insights` (
  `insight_id` int NOT NULL,
  `branch_id` int NOT NULL,
  `insight_type` enum('PEAK_TIME','CUSTOMER_DEMO','PRODUCT_PREF','GENERAL_NOTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cars`
--

CREATE TABLE `cars` (
  `car_id` int NOT NULL,
  `license_plate` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_id` int NOT NULL,
  `status` enum('AVAILABLE','IN_TRANSIT','MAINTENANCE','DECOMMISSIONED') COLLATE utf8mb4_unicode_ci DEFAULT 'AVAILABLE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cars`
--

INSERT INTO `cars` (`car_id`, `license_plate`, `type_id`, `status`) VALUES
(1, '70-9999 กรุงเทพ', 1, 'AVAILABLE'),
(2, 'กข-1234 เชียงใหม่', 2, 'AVAILABLE'),
(3, 'ผก-1111 เชียงราย', 2, 'AVAILABLE'),
(4, 'ผก-2222 เชียงราย', 2, 'AVAILABLE'),
(5, 'ผก-3333 พะเยา', 2, 'AVAILABLE'),
(6, 'ผก-4444 พะเยา', 2, 'AVAILABLE'),
(7, 'ชม-2549 เชียงใหม่', 1, 'AVAILABLE'),
(8, '1', 1, 'AVAILABLE');

-- --------------------------------------------------------

--
-- Table structure for table `car_type`
--

CREATE TABLE `car_type` (
  `type_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_load_weight_kg` decimal(10,2) DEFAULT NULL,
  `max_load_volume_m3` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `car_type`
--

INSERT INTO `car_type` (`type_id`, `name`, `max_load_weight_kg`, `max_load_volume_m3`) VALUES
(1, '10-Wheel Truck', 16000.00, 10.00),
(2, '4-Wheel Pickup', 1500.00, 3.00);

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `emp_id` int NOT NULL,
  `firstname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`emp_id`, `firstname`, `lastname`, `telephone`, `email`, `job_id`, `is_active`) VALUES
(1, 'สมชาย', 'ใจดี', NULL, 'somchai@farmhouse.co.th', 1, 1),
(2, 'วิชัย', 'ขายเก่ง', NULL, 'wichai@farmhouse.co.th', 2, 1),
(3, 'อำนาจ', 'ขับไว', NULL, 'art@farmhouse.co.th', 1, 1),
(4, 'ปราณี', 'ละเอียด', NULL, 'pranee@farmhouse.co.th', 2, 1),
(9, 'มานะ', 'อดทน', NULL, NULL, 1, 1),
(10, 'ปิติ', 'รักงาน', NULL, NULL, 2, 1);

-- --------------------------------------------------------

--
-- Table structure for table `inventory_stock`
--

CREATE TABLE `inventory_stock` (
  `stock_id` int NOT NULL,
  `branch_id` int NOT NULL,
  `lot_id` int NOT NULL,
  `quantity` int DEFAULT '0',
  `status` enum('QC_PENDING','AVAILABLE','RESERVED','EXPIRED','DAMAGED') COLLATE utf8mb4_unicode_ci DEFAULT 'AVAILABLE',
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_description`
--

CREATE TABLE `job_description` (
  `job_id` int NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `job_description`
--

INSERT INTO `job_description` (`job_id`, `title`, `details`) VALUES
(1, 'Driver', NULL),
(2, 'Sales', NULL),
(3, 'Manager', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `lot_definitions`
--

CREATE TABLE `lot_definitions` (
  `lot_id` int NOT NULL,
  `lot_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` int NOT NULL,
  `mfg_date` date NOT NULL,
  `exp_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int NOT NULL,
  `order_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_branch_id` int NOT NULL,
  `shipment_id` int DEFAULT NULL,
  `order_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` enum('PENDING','APPROVED','PLANNED','LOADED','DELIVERED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `order_code`, `customer_branch_id`, `shipment_id`, `order_date`, `status`) VALUES
(17, 'ORD-1771494551506-b12eyqn', 3, 13, '2026-02-19 16:49:11', 'DELIVERED'),
(18, 'ORD-1771494551510-ngrg3tb', 4, 13, '2026-02-19 16:49:11', 'DELIVERED'),
(19, 'ORD-1771504134069-06dljct', 3, 14, '2026-02-19 19:28:54', 'DELIVERED'),
(20, 'ORD-1771504134070-un3ammh', 4, 14, '2026-02-19 19:28:54', 'DELIVERED'),
(21, 'ORD-1771504835727-rfvlfho', 4, 15, '2026-02-19 19:40:35', 'LOADED'),
(22, 'ORD-1771504835731-j1xhrm7', 3, 15, '2026-02-19 19:40:35', 'LOADED');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `item_id` int NOT NULL,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `requested_qty` int NOT NULL,
  `fulfilled_qty` int DEFAULT '0',
  `lot_id` int DEFAULT NULL,
  `unit_price_at_order` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`item_id`, `order_id`, `product_id`, `requested_qty`, `fulfilled_qty`, `lot_id`, `unit_price_at_order`) VALUES
(1, 17, 268, 1, 0, NULL, 15.00),
(2, 18, 268, 1, 0, NULL, 15.00),
(3, 19, 268, 1, 0, NULL, 15.00),
(4, 20, 268, 1, 0, NULL, 15.00),
(5, 21, 216, 80, 0, NULL, 36.00),
(6, 21, 215, 80, 0, NULL, 38.00),
(7, 21, 221, 600, 0, NULL, 46.00),
(8, 21, 212, 590, 0, NULL, 35.00),
(9, 21, 220, 600, 0, NULL, 48.00),
(10, 21, 218, 700, 0, NULL, 42.00),
(11, 21, 219, 700, 0, NULL, 45.00),
(12, 22, 215, 700, 0, NULL, 38.00),
(13, 22, 221, 650, 0, NULL, 46.00),
(14, 22, 212, 80, 0, NULL, 35.00),
(15, 22, 214, 750, 0, NULL, 33.00),
(16, 22, 220, 550, 0, NULL, 48.00),
(17, 22, 213, 755, 0, NULL, 32.00),
(18, 22, 218, 80, 0, NULL, 42.00),
(19, 22, 219, 80, 0, NULL, 45.00);

-- --------------------------------------------------------

--
-- Table structure for table `product`
--

CREATE TABLE `product` (
  `product_id` int NOT NULL,
  `barcode` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `weight_g` decimal(10,2) DEFAULT NULL,
  `width_cm` decimal(10,2) DEFAULT NULL,
  `height_cm` decimal(10,2) DEFAULT NULL,
  `length_cm` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `shelf_life_days` smallint DEFAULT NULL,
  `storage_temp_c` decimal(6,2) DEFAULT NULL,
  `category_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `product`
--

INSERT INTO `product` (`product_id`, `barcode`, `name`, `description`, `weight_g`, `width_cm`, `height_cm`, `length_cm`, `unit_price`, `shelf_life_days`, `storage_temp_c`, `category_id`, `is_active`) VALUES
(212, '8850123002120', 'ขนมปังโฮลวีท', 'ขนมปังโฮลวีทสูตรดั้งเดิม อบสดใหม่ทุกวัน', 450.00, 12.00, 8.00, 25.00, 35.00, 15, 25.00, 1, 1),
(213, '8850123002137', 'รอยัลธัญพืชข้าวงอก', 'ขนมปังธัญพืชผสมข้าวงอกเนื้อนุ่ม รสชาติหอมหวาน มีกาบา', 400.00, 12.00, 7.50, 24.00, 32.00, 12, 25.00, 1, 1),
(214, '8850123002144', 'ขนมปังโฮลวีทชนิดเนื้อละเอียด', 'ขนมปังโฮลวีทเนื้อละเอียด ทานง่าย เหมาะสำหรับเด็ก', 420.00, 12.00, 7.80, 24.50, 33.00, 12, 25.00, 1, 1),
(215, '8850123002151', 'ขนมปังลูกเกด', 'ขนมปังแผ่นผสมลูกเกดแท้ หวานอร่อย', 430.00, 12.00, 8.00, 25.00, 38.00, 14, 25.00, 1, 1),
(216, '8850123002168', 'ขนมปังรสโอวัลตินบัตเตอร์สก็อต', 'ขนมปังแผ่นรสโอวัลตินบัตเตอร์สก็อต', 440.00, 12.00, 8.00, 25.00, 36.00, 13, 25.00, 1, 1),
(217, '8850123002175', 'ขนมปังบัตเตอร์สก็อต', 'ขนมปังแผ่นรสบัตเตอร์สก็อต หอมกลิ่นเนยและคาราเมล', 380.00, 11.50, 7.00, 23.00, 34.00, 12, 25.00, 1, 1),
(218, '8850123002182', 'รอยัลเบรด', 'ขนมปังชนิดแผ่นเนื้อนุ่มสไลด์หนา สูตรพรีเมียม', 450.00, 12.00, 8.50, 25.00, 42.00, 15, 25.00, 1, 1),
(219, '8850123002199', 'รอยัลโฮลวีท', 'ขนมปังโฮลวีทเนื้อนุ่มสไลด์หนา คัดสรรวัตถุดิบชั้นเลิศ', 460.00, 12.00, 8.50, 25.50, 45.00, 14, 25.00, 1, 1),
(220, '8850123002205', 'รอยัล 12 เกรน', 'ขนมปังธัญพืช 12 ชนิด เนื้อนุ่มสไลด์หนา', 480.00, 12.50, 9.00, 26.00, 48.00, 15, 25.00, 1, 1),
(221, '8850123002212', 'ขนมปังแผ่นขาว', 'ขนมปังชนิดแผ่น เนื้อนุ่ม ผลิตจากแป้งสาลีไม่ฟอกขาว 100%', 470.00, 12.50, 8.50, 25.50, 46.00, 14, 25.00, 1, 1),
(222, '8850123002229', 'ขนมปังสำหรับเบอร์เกอร์โรยงา', 'ขนมปังเบอร์เกอร์โรยงา เนื้อนุ่ม', 300.00, 15.00, 6.00, 20.00, 28.00, 10, 25.00, 2, 1),
(223, '8850123002236', 'ขนมปังสำหรับเบอร์เกอร์', 'ขนมปังเบอร์เกอร์ (ไม่โรยงา) เนื้อนุ่ม', 280.00, 14.50, 5.50, 19.50, 26.00, 10, 25.00, 2, 1),
(224, '8850123002243', 'ขนมปังสำหรับฮอตดอก', 'ขนมปังฮอทดอก รสชาติหอมนุ่ม เหมาะทำฮอทดอก', 320.00, 10.00, 5.00, 22.00, 27.00, 10, 25.00, 2, 1),
(225, '8850123002250', 'สวีทแซนด์วิช ไส้ช็อกโกแลต', 'ขนมปังสแน็ครสช็อกโกแลต หวานมัน', 80.00, 8.00, 4.00, 12.00, 12.00, 21, 25.00, 3, 1),
(226, '8850123002267', 'สวีทแซนด์วิช ไส้ครีมนมเนยอัลมอนด์', 'ขนมปังสแน็คไส้ครีมนมเนยอัลมอนด์ หอมมัน', 75.00, 8.00, 4.00, 12.00, 11.00, 21, 25.00, 3, 1),
(227, '8850123002274', 'สวีทแซนด์วิช ไส้สังขยาใบเตย', 'ขนมปังสแน็คไส้สังขยาใบเตย หอมกลิ่นใบเตยแท้', 78.00, 8.00, 4.00, 12.00, 11.50, 21, 25.00, 3, 1),
(228, '8850123002281', 'เดลี่แซนด์วิช ไส้ทูน่ามายองเนส', 'ขนมปังแซนด์วิชสอดไส้ทูน่ามายองเนส', 85.00, 8.50, 4.50, 12.50, 13.00, 18, 25.00, 3, 1),
(229, '8850123002298', 'เดลี่แซนด์วิช ไส้ปูอัดมายองเนส', 'ขนมปังแซนด์วิชสอดไส้ปูอัดมายองเนส', 85.00, 8.50, 4.50, 12.50, 13.00, 18, 25.00, 3, 1),
(230, '8850123002304', 'เดลี่แซนด์วิช ไส้หมูหยองมายองเนส', 'ขนมปังแซนด์วิชสอดไส้หมูหยองมายองเนส', 88.00, 8.50, 4.50, 12.50, 13.50, 18, 25.00, 3, 1),
(231, '8850123002311', 'แซนด์วิชทูโทน ไส้ช็อกโกแลตและสตรอเบอร์รี่', 'ขนมปังแซนด์วิชสองสี ไส้ช็อกโกแลตและสตรอเบอร์รี่', 87.00, 8.50, 4.50, 12.50, 13.50, 18, 25.00, 3, 1),
(232, '8850123002328', 'แซนด์วิชทูโทน ไส้นมเนยและสตรอเบอร์รี่', 'ขนมปังแซนด์วิชสองสี ไส้นมเนยและสตรอเบอร์รี่', 86.00, 8.50, 4.50, 12.50, 13.00, 18, 25.00, 3, 1),
(233, '8850123002335', 'ขนมปังทาหน้าเนย', 'ขนมปังทาหน้าเนย หอมมัน', 70.00, 8.00, 4.00, 11.50, 10.00, 20, 25.00, 3, 1),
(234, '8850123002342', 'ขนมปังทาหน้าสังขยา', 'ขนมปังทาหน้าสังขยา หอมหวาน', 72.00, 8.00, 4.00, 11.50, 10.50, 20, 25.00, 3, 1),
(235, '8850123002359', 'ขนมปังทาหน้าช็อกโกแลต', 'ขนมปังทาหน้าช็อกโกแลต เข้มข้น', 65.00, 7.50, 3.50, 11.00, 9.00, 20, 25.00, 3, 1),
(236, '8850123002366', 'ขนมปังทาหน้ากลิ่นมอคค่า', 'ขนมปังทาหน้ากลิ่นมอคค่า หอมกลิ่นกาแฟ', 65.00, 7.50, 3.50, 11.00, 9.00, 20, 25.00, 3, 1),
(237, '8850123002373', 'ขนมปังทาหน้าครีมกลิ่นนมฮอกไกโด', 'ขนมปังทาหน้าครีมกลิ่นนมฮอกไกโด หอมนุ่ม', 68.00, 7.50, 3.50, 11.00, 9.50, 20, 25.00, 3, 1),
(238, '8850123002380', 'แซนด์วิชเค้ก รสกาแฟ', 'แซนด์วิชเค้กเนื้อนุ่ม รสกาแฟ', 45.00, 7.00, 3.00, 10.00, 10.00, 25, 25.00, 3, 1),
(239, '8850123002397', 'แซนด์วิชเค้ก กลิ่นวานิลลา', 'แซนด์วิชเค้กเนื้อนุ่ม กลิ่นวานิลลา', 45.00, 7.00, 3.00, 10.00, 10.00, 25, 25.00, 3, 1),
(240, '8850123002403', 'แซนด์วิชเค้ก กลิ่นใบเตย', 'แซนด์วิชเค้กเนื้อนุ่ม กลิ่นใบเตย', 45.00, 7.00, 3.00, 10.00, 10.50, 25, 25.00, 3, 1),
(241, '8850123002410', 'โดนัทเค้ก ไส้คัสตาร์ดช็อกโกแลต', 'โดนัทเค้กเนื้อนุ่มสอดไส้คัสตาร์ดช็อกโกแลต', 90.00, 10.00, 4.50, 10.00, 15.00, 12, 25.00, 4, 1),
(242, '8850123002427', 'โดนัทเค้ก ไส้คัสตาร์ดวานิลลา', 'โดนัทเค้กเนื้อนุ่มสอดไส้คัสตาร์ดวานิลลา', 88.00, 10.00, 4.50, 10.00, 14.50, 12, 25.00, 4, 1),
(243, '8850123002434', 'โดนัทเค้ก ไส้สังขยา', 'โดนัทเค้กเนื้อนุ่มสอดไส้สังขยา', 92.00, 10.00, 4.50, 10.00, 16.00, 12, 25.00, 4, 1),
(244, '8850123002441', 'โดนัทเค้ก ไส้คัสตาร์ดกาแฟ', 'โดนัทเค้กเนื้อนุ่มสอดไส้คัสตาร์ดกาแฟ', 85.00, 10.00, 4.50, 10.00, 14.00, 12, 25.00, 4, 1),
(245, '8850123002458', 'ขนมปังโดนัท กลิ่นนมช็อกโกแลต', 'โดนัทเคลือบน้ำตาลกลิ่นนมช็อกโกแลต', 87.00, 10.00, 4.50, 10.00, 15.50, 12, 25.00, 4, 1),
(246, '8850123002465', 'ขนมปังไส้สังขยานม', 'ขนมปังสอดไส้สังขยานม หวานนุ่ม อร่อย', 75.00, 8.00, 7.00, 8.00, 12.00, 14, 25.00, 5, 1),
(247, '8850123002472', 'ขนมปังไส้คัสตาร์ดครีม', 'ขนมปังสอดไส้คัสตาร์ดครีม รสหวานมัน', 78.00, 8.00, 7.00, 8.00, 13.00, 14, 25.00, 5, 1),
(248, '8850123002489', 'ขนมปังไส้คัสตาร์ดช็อกโกแลต', 'ขนมปังสอดไส้คัสตาร์ดช็อกโกแลต เข้มข้น', 80.00, 8.00, 7.00, 8.00, 13.50, 14, 25.00, 5, 1),
(249, '8850123002496', 'ขนมปังไส้สังขยา', 'ขนมปังสอดไส้สังขยาใบเตย หอมหวาน', 82.00, 8.00, 7.00, 8.00, 14.00, 14, 25.00, 5, 1),
(250, '8850123002502', 'ขนมปังไส้เผือก', 'ขนมปังสอดไส้เผือก หอมอร่อย', 85.00, 8.00, 7.00, 8.00, 15.00, 14, 25.00, 5, 1),
(251, '8850123002519', 'ขนมปังไส้ถั่วแดง', 'ขนมปังสอดไส้ถั่วแดง เนื้อเนียน', 76.00, 8.00, 7.00, 8.00, 12.50, 14, 25.00, 5, 1),
(252, '8850123002526', 'ขนมปังไส้ถั่วดำ', 'ขนมปังสอดไส้ถั่วดำ สูตรโบราณ', 79.00, 8.00, 7.00, 8.00, 13.00, 14, 25.00, 5, 1),
(253, '8850123002533', 'ขนมปังโลฟ ลูกเกด', 'ขนมปังโลฟผสมลูกเกด เนื้อนุ่ม', 120.00, 12.00, 8.50, 12.00, 18.00, 15, 25.00, 5, 1),
(254, '8850123002540', 'ขนมปังโลฟ โกโก้ลูกเกดช็อกโกแลตชิพ', 'ขนมปังโลฟรสโกโก้ ผสมลูกเกดและช็อกโกแลตชิพ', 118.00, 12.00, 8.50, 12.00, 17.50, 15, 25.00, 5, 1),
(255, '8850123002557', 'ขนมปังโลฟ รสมอคค่าบัตเตอร์สก็อต', 'ขนมปังโลฟรสมอคค่า ผสมบัตเตอร์สก็อต', 115.00, 12.00, 8.50, 12.00, 17.00, 15, 25.00, 5, 1),
(256, '8850123002564', 'ขนมปังแพ เนย', 'ขนมปังแพรสเนย หอมนุ่ม', 122.00, 12.00, 8.50, 12.00, 18.50, 15, 25.00, 5, 1),
(257, '8850123002571', 'ขนมปังฮอตดอกไส้ครีมกลิ่นนมฮอกไกโด', 'ขนมปังฮอตดอกสอดไส้ครีมกลิ่นนมฮอกไกโด', 60.00, 5.00, 3.50, 15.00, 10.00, 18, 25.00, 6, 1),
(258, '8850123002588', 'ขนมปังฮอตดอกไส้ครีมรสกล้วยหอม', 'ขนมปังฮอตดอกสอดไส้ครีมรสกล้วยหอม', 62.00, 5.00, 3.50, 15.00, 10.50, 18, 25.00, 6, 1),
(259, '8850123002595', 'ขนมปังฮอตดอกไส้ครีมรสช็อกโกแลต', 'ขนมปังฮอตดอกสอดไส้ครีมรสช็อกโกแลต', 65.00, 5.00, 3.50, 15.00, 11.00, 18, 25.00, 6, 1),
(260, '8850123002601', 'ขนมปังฮอตดอกไส้ครีมรสกาแฟ', 'ขนมปังฮอตดอกสอดไส้ครีมรสกาแฟ', 58.00, 5.00, 3.50, 15.00, 9.50, 18, 25.00, 6, 1),
(261, '8850123002618', 'ขนมปังฮอตดอกไส้ครีมกลิ่นสับปะรด', 'ขนมปังฮอตดอกสอดไส้ครีมกลิ่นสับปะรด', 63.00, 5.00, 3.50, 15.00, 10.50, 18, 25.00, 6, 1),
(262, '8850123002625', 'ขนมปังฮอตดอกไส้ครีมกลิ่นสตรอเบอร์รี่', 'ขนมปังฮอตดอกสอดไส้ครีมกลิ่นสตรอเบอร์รี่', 61.00, 5.00, 3.50, 15.00, 10.00, 18, 25.00, 6, 1),
(263, '8850123002632', 'ขนมปังฮอตดอกไส้โอวัลตินครันชี่', 'ขนมปังฮอตดอกสอดไส้โอวัลตินครันชี่', 59.00, 5.00, 3.50, 15.00, 10.00, 18, 25.00, 6, 1),
(264, '8850123002649', 'ขนมปังฮอตดอกไส้ครีมกลิ่นนมฮอกไกโดอัลมอนด์', 'ขนมปังฮอตดอกสอดไส้ครีมกลิ่นนมฮอกไกโดและอัลมอนด์', 64.00, 5.00, 3.50, 15.00, 11.00, 18, 25.00, 6, 1),
(265, '8850123002656', 'ขนมปังฮอตดอกไส้ครีมรสกาแฟอัลมอนด์', 'ขนมปังฮอตดอกสอดไส้ครีมรสกาแฟและอัลมอนด์', 66.00, 5.00, 3.50, 15.00, 11.50, 18, 25.00, 6, 1),
(266, '8850123002663', 'ขนมปังฮอตดอกไส้ครีมรสสตรอเบอร์รี่ลูกเกด', 'ขนมปังฮอตดอกสอดไส้ครีมรสสตรอเบอร์รี่และลูกเกด', 67.00, 5.00, 3.50, 15.00, 12.00, 18, 25.00, 6, 1),
(267, '8850123002670', 'ขนมปังกรอบอบเนย', 'ขนมปังกรอบอบเนย หอมกรุ่น กรอบอร่อย', 95.00, 10.00, 3.00, 10.00, 16.00, 12, 25.00, 7, 1),
(268, '8850123002687', 'ขนมปังกรอบลูกเกดอบเนย', 'ขนมปังกรอบผสมลูกเกดอบเนย', 92.00, 10.00, 3.00, 10.00, 15.00, 12, 25.00, 7, 1),
(269, '8850123002694', 'คิวบ์ปัง ขนมปังกรอบรสชีส', 'ขนมปังกรอบทรงลูกเต๋า รสชีส', 98.00, 10.00, 3.00, 10.00, 17.00, 12, 25.00, 7, 1),
(270, '8850123002700', 'คิวบ์ปัง ขนมปังกรอบรสโนริสาหร่าย', 'ขนมปังกรอบทรงลูกเต๋า รสโนริสาหร่าย', 93.00, 10.00, 3.00, 10.00, 16.50, 12, 25.00, 7, 1),
(271, '8850123002717', 'พายไส้ช็อกโกแลต', 'พายกรอบสอดไส้ช็อกโกแลตเข้มข้น', 130.00, 13.00, 6.50, 18.00, 32.00, 14, 25.00, 8, 1),
(272, '8850123002724', 'พายไส้สับปะรด', 'พายกรอบสอดไส้สับปะรดกวน', 125.00, 13.00, 6.50, 18.00, 30.00, 14, 25.00, 8, 1),
(273, '8850123002731', 'พายไส้ข้าวโพด', 'พายกรอบสอดไส้ครีมข้าวโพด', 128.00, 13.00, 6.50, 18.00, 33.00, 14, 25.00, 8, 1),
(274, '8850123002748', 'โดรายากิ ไส้ช็อกโกแลต', 'โดรายากิเนื้อนุ่มสอดไส้ช็อกโกแลต', 180.00, 8.00, 7.50, 16.00, 35.00, 20, 20.00, 9, 1),
(275, '8850123002755', 'โดรายากิ ไส้คัสตาร์ดครี้ม', 'โดรายากิเนื้อนุ่มสอดไส้คัสตาร์ดครีม', 185.00, 8.00, 7.50, 16.00, 36.00, 20, 20.00, 9, 1),
(276, '8850123002762', 'โดรายากิ ไส้ครีมอัลมอนด์', 'โดรายากิเนื้อนุ่มสอดไส้ครีมอัลมอนด์', 175.00, 8.00, 7.50, 16.00, 34.00, 20, 20.00, 9, 1),
(277, '8850123002779', 'โดรายากิ ไส้โอวัลตินครันชี่', 'โดรายากิเนื้อนุ่มสอดไส้โอวัลตินครันชี่', 170.00, 8.00, 7.50, 16.00, 33.00, 20, 20.00, 9, 1),
(278, '8850123002786', 'บัตเตอร์คุกกี้ วานิลลา', 'บัตเตอร์คุกกี้กลิ่นวานิลลา กรอบอร่อย', 65.00, 10.00, 2.50, 15.00, 18.00, 30, 25.00, 10, 1),
(279, '8850123002793', 'บัตเตอร์คุกกี้ ช็อกโกแลต', 'บัตเตอร์คุกกี้รสช็อกโกแลต เข้มข้น', 68.00, 10.00, 2.50, 15.00, 19.00, 30, 25.00, 10, 1),
(280, '8850123002809', 'เค้กโรล รสกาแฟ', 'เค้กโรลเนื้อนุ่มรสกาแฟ', 160.00, 7.50, 7.00, 15.50, 28.00, 18, 20.00, 9, 1),
(281, '8850123002816', 'เค้กโรล กลิ่นวานิลลา', 'เค้กโรลเนื้อนุ่มกลิ่นวานิลลา', 155.00, 7.50, 7.00, 15.50, 27.00, 18, 20.00, 9, 1),
(282, '8850123002823', 'เค้กโรล กลิ่นใบเตย', 'เค้กโรลเนื้อนุ่มกลิ่นใบเตย', 158.00, 7.50, 7.00, 15.50, 27.50, 18, 20.00, 9, 1),
(283, '8850123002830', 'เค้กโรล กลิ่นนมฮอกไกโด', 'เค้กโรลเนื้อนุ่มกลิ่นนมฮอกไกโด', 152.00, 7.50, 7.00, 15.50, 26.00, 18, 20.00, 9, 1),
(284, '8850123002847', 'เค้กโมจิ นมเนยอัลมอนด์', 'เค้กโมจิรสนมเนยอัลมอนด์ เนื้อหนึบ', 45.00, 6.00, 2.50, 9.00, 8.00, 25, 25.00, 3, 1),
(285, '8850123002854', 'เค้กโมจิ ดับเบิ้ลช็อกโกแลต', 'เค้กโมจิรสดับเบิ้ลช็อกโกแลต เข้มข้น', 47.00, 6.00, 2.50, 9.00, 8.50, 25, 25.00, 3, 1),
(286, '8850123002861', 'เค้กกล้วยหอม', 'เค้กกล้วยหอมสูตรต้นตำรับ', 46.00, 6.00, 2.50, 9.00, 8.00, 25, 25.00, 3, 1),
(287, '8850123002878', 'ครัวซองต์', 'ครัวซองต์เนยสด กรอบนอกนุ่มใน', 110.00, 10.00, 5.50, 12.00, 25.00, 12, 25.00, 11, 1),
(288, '8850123002885', 'บราวนี่อัลมอนด์', 'บราวนี่หน้าอัลมอนด์ รสเข้มข้น', 95.00, 9.00, 4.00, 11.00, 22.00, 15, 25.00, 12, 1);

-- --------------------------------------------------------

--
-- Table structure for table `product_category`
--

CREATE TABLE `product_category` (
  `category_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `product_category`
--

INSERT INTO `product_category` (`category_id`, `name`, `description`) VALUES
(1, 'ขนมปังชนิดแผ่น', 'ขนมปังแผ่นทั่วไป เช่น ขนมปังแผ่นสไลด์'),
(2, 'ขนมปังสำหรับเบอร์เกอร์', 'ขนมปังสำหรับทำเบอร์เกอร์'),
(3, 'ขนมปังสำหรับฮอตดอก', 'ขนมปังสำหรับทำฮอตดอก'),
(4, 'ขนมปังพร้อมทาน', 'ขนมปังที่พร้อมรับประทานได้ทันที'),
(5, 'เค้กพร้อมทาน', 'เค้กที่พร้อมรับประทาน'),
(6, 'เบเกอรี่อื่นๆ', 'ผลิตภัณฑ์เบเกอรี่ประเภทอื่นๆ'),
(7, 'ตู้จำหน่ายขนมปังจัดในบิต', 'ขนมปังสำหรับจัดในตู้จำหน่าย'),
(8, 'ฟาร์มเฮ้าส์เดลิเวอรี่', 'สินค้าสำหรับบริการจัดส่ง Farmhouse Delivery'),
(9, 'ภูมิเมอร์นิ่งฟาร์มเฮ้าส์', 'สินค้าสำหรับบริการ Bhuminerning Farmhouse'),
(10, 'ผลิตภัณฑ์นมทอด', 'ผลิตภัณฑ์นมแบบทอด'),
(11, 'ครัวซองต์', 'สินค้าประเภทครัวซองต์'),
(12, 'บราวนี่', 'สินค้าประเภทบราวนี่');

-- --------------------------------------------------------

--
-- Table structure for table `returns`
--

CREATE TABLE `returns` (
  `return_id` int NOT NULL,
  `original_order_id` int NOT NULL,
  `return_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('REQUESTED','APPROVED','RECEIVED','REFUNDED') COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `return_items`
--

CREATE TABLE `return_items` (
  `ret_item_id` int NOT NULL,
  `return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty` int NOT NULL,
  `condition_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `routes`
--

CREATE TABLE `routes` (
  `route_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` enum('Primary','Secondary') COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `routes`
--

INSERT INTO `routes` (`route_id`, `name`, `description`, `type`) VALUES
(1, 'Route Manu-DC-Retailer', 'จำลอง โรงงาน -> DC -> ร้านค้า', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `route_stops`
--

CREATE TABLE `route_stops` (
  `stop_id` int NOT NULL,
  `route_id` int NOT NULL,
  `branch_id` int NOT NULL,
  `stop_sequence` int NOT NULL,
  `estimated_travel_min` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `route_stops`
--

INSERT INTO `route_stops` (`stop_id`, `route_id`, `branch_id`, `stop_sequence`, `estimated_travel_min`) VALUES
(10, 1, 2, 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `shipments`
--

CREATE TABLE `shipments` (
  `shipment_id` int NOT NULL,
  `shipment_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route_id` int DEFAULT NULL,
  `car_id` int NOT NULL,
  `driver_emp_id` int NOT NULL,
  `sales_emp_id` int DEFAULT NULL,
  `departure_time` datetime DEFAULT NULL,
  `arrival_time` datetime DEFAULT NULL,
  `status` enum('PLANNING','LOADING','IN_TRANSIT','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT 'PLANNING'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shipments`
--

INSERT INTO `shipments` (`shipment_id`, `shipment_code`, `route_id`, `car_id`, `driver_emp_id`, `sales_emp_id`, `departure_time`, `arrival_time`, `status`) VALUES
(13, 'SHP-20260219-TA4828', 1, 1, 1, 10, '2026-02-19 16:49:35', NULL, 'COMPLETED'),
(14, 'SHP-20260219-TFTM0K', 1, 1, 9, 4, '2026-02-19 19:29:03', NULL, 'COMPLETED'),
(15, 'SHP-20260219-TG8NF2', 1, 1, 9, 4, '2026-02-19 19:41:46', NULL, 'IN_TRANSIT');

-- --------------------------------------------------------

--
-- Table structure for table `shipment_dc_assignment`
--

CREATE TABLE `shipment_dc_assignment` (
  `id` int NOT NULL,
  `shipment_id` int NOT NULL,
  `dc_branch_id` int NOT NULL,
  `local_car_id` int DEFAULT NULL,
  `driver_emp_id` int DEFAULT NULL,
  `sales_emp_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shipment_dc_assignment`
--

INSERT INTO `shipment_dc_assignment` (`id`, `shipment_id`, `dc_branch_id`, `local_car_id`, `driver_emp_id`, `sales_emp_id`, `created_at`) VALUES
(3, 13, 2, 2, 9, 4, '2026-02-19 09:49:11'),
(4, 14, 2, 2, 1, 10, '2026-02-19 12:28:54'),
(5, 15, 2, 2, 1, 10, '2026-02-19 12:40:35');

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `movement_id` int NOT NULL,
  `stock_id` int NOT NULL,
  `movement_type` enum('INBOUND_PO','OUTBOUND_ORDER','TRANSFER','ADJUSTMENT','RETURN','WASTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty_change` int NOT NULL,
  `reference_doc` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by_emp_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `box_size`
--
ALTER TABLE `box_size`
  ADD PRIMARY KEY (`box_id`);

--
-- Indexes for table `branch`
--
ALTER TABLE `branch`
  ADD PRIMARY KEY (`branch_id`),
  ADD KEY `cat_id` (`cat_id`),
  ADD KEY `manager_emp_id` (`manager_emp_id`),
  ADD KEY `fk_branch_parent` (`parent_branch_id`);

--
-- Indexes for table `branch_category`
--
ALTER TABLE `branch_category`
  ADD PRIMARY KEY (`cat_id`);

--
-- Indexes for table `branch_insights`
--
ALTER TABLE `branch_insights`
  ADD PRIMARY KEY (`insight_id`),
  ADD KEY `branch_id` (`branch_id`);

--
-- Indexes for table `cars`
--
ALTER TABLE `cars`
  ADD PRIMARY KEY (`car_id`),
  ADD UNIQUE KEY `license_plate` (`license_plate`),
  ADD KEY `type_id` (`type_id`);

--
-- Indexes for table `car_type`
--
ALTER TABLE `car_type`
  ADD PRIMARY KEY (`type_id`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`emp_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `job_id` (`job_id`);

--
-- Indexes for table `inventory_stock`
--
ALTER TABLE `inventory_stock`
  ADD PRIMARY KEY (`stock_id`),
  ADD UNIQUE KEY `unique_stock` (`branch_id`,`lot_id`,`status`),
  ADD KEY `lot_id` (`lot_id`);

--
-- Indexes for table `job_description`
--
ALTER TABLE `job_description`
  ADD PRIMARY KEY (`job_id`);

--
-- Indexes for table `lot_definitions`
--
ALTER TABLE `lot_definitions`
  ADD PRIMARY KEY (`lot_id`),
  ADD UNIQUE KEY `lot_code` (`lot_code`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD UNIQUE KEY `order_code` (`order_code`),
  ADD KEY `customer_branch_id` (`customer_branch_id`),
  ADD KEY `shipment_id` (`shipment_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `lot_id` (`lot_id`);

--
-- Indexes for table `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`product_id`),
  ADD UNIQUE KEY `barcode` (`barcode`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `product_category`
--
ALTER TABLE `product_category`
  ADD PRIMARY KEY (`category_id`);

--
-- Indexes for table `returns`
--
ALTER TABLE `returns`
  ADD PRIMARY KEY (`return_id`),
  ADD KEY `original_order_id` (`original_order_id`);

--
-- Indexes for table `return_items`
--
ALTER TABLE `return_items`
  ADD PRIMARY KEY (`ret_item_id`),
  ADD KEY `return_id` (`return_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `routes`
--
ALTER TABLE `routes`
  ADD PRIMARY KEY (`route_id`);

--
-- Indexes for table `route_stops`
--
ALTER TABLE `route_stops`
  ADD PRIMARY KEY (`stop_id`),
  ADD KEY `route_id` (`route_id`),
  ADD KEY `branch_id` (`branch_id`);

--
-- Indexes for table `shipments`
--
ALTER TABLE `shipments`
  ADD PRIMARY KEY (`shipment_id`),
  ADD UNIQUE KEY `shipment_code` (`shipment_code`),
  ADD KEY `route_id` (`route_id`),
  ADD KEY `car_id` (`car_id`),
  ADD KEY `driver_emp_id` (`driver_emp_id`),
  ADD KEY `fk_shipment_sales` (`sales_emp_id`);

--
-- Indexes for table `shipment_dc_assignment`
--
ALTER TABLE `shipment_dc_assignment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_shipment_dc` (`shipment_id`,`dc_branch_id`),
  ADD KEY `ix_shipment` (`shipment_id`),
  ADD KEY `ix_dc` (`dc_branch_id`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`movement_id`),
  ADD KEY `stock_id` (`stock_id`),
  ADD KEY `performed_by_emp_id` (`performed_by_emp_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `box_size`
--
ALTER TABLE `box_size`
  MODIFY `box_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `branch`
--
ALTER TABLE `branch`
  MODIFY `branch_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `branch_category`
--
ALTER TABLE `branch_category`
  MODIFY `cat_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `branch_insights`
--
ALTER TABLE `branch_insights`
  MODIFY `insight_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cars`
--
ALTER TABLE `cars`
  MODIFY `car_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `car_type`
--
ALTER TABLE `car_type`
  MODIFY `type_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `emp_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `inventory_stock`
--
ALTER TABLE `inventory_stock`
  MODIFY `stock_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `job_description`
--
ALTER TABLE `job_description`
  MODIFY `job_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `lot_definitions`
--
ALTER TABLE `lot_definitions`
  MODIFY `lot_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `item_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `product`
--
ALTER TABLE `product`
  MODIFY `product_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=289;

--
-- AUTO_INCREMENT for table `product_category`
--
ALTER TABLE `product_category`
  MODIFY `category_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `returns`
--
ALTER TABLE `returns`
  MODIFY `return_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `return_items`
--
ALTER TABLE `return_items`
  MODIFY `ret_item_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `routes`
--
ALTER TABLE `routes`
  MODIFY `route_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `route_stops`
--
ALTER TABLE `route_stops`
  MODIFY `stop_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `shipments`
--
ALTER TABLE `shipments`
  MODIFY `shipment_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `shipment_dc_assignment`
--
ALTER TABLE `shipment_dc_assignment`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `movement_id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `branch`
--
ALTER TABLE `branch`
  ADD CONSTRAINT `branch_ibfk_1` FOREIGN KEY (`cat_id`) REFERENCES `branch_category` (`cat_id`),
  ADD CONSTRAINT `branch_ibfk_2` FOREIGN KEY (`manager_emp_id`) REFERENCES `employees` (`emp_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_branch_parent` FOREIGN KEY (`parent_branch_id`) REFERENCES `branch` (`branch_id`);

--
-- Constraints for table `branch_insights`
--
ALTER TABLE `branch_insights`
  ADD CONSTRAINT `branch_insights_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branch_id`) ON DELETE CASCADE;

--
-- Constraints for table `cars`
--
ALTER TABLE `cars`
  ADD CONSTRAINT `cars_ibfk_1` FOREIGN KEY (`type_id`) REFERENCES `car_type` (`type_id`);

--
-- Constraints for table `employees`
--
ALTER TABLE `employees`
  ADD CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `job_description` (`job_id`);

--
-- Constraints for table `inventory_stock`
--
ALTER TABLE `inventory_stock`
  ADD CONSTRAINT `inventory_stock_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branch_id`),
  ADD CONSTRAINT `inventory_stock_ibfk_2` FOREIGN KEY (`lot_id`) REFERENCES `lot_definitions` (`lot_id`);

--
-- Constraints for table `lot_definitions`
--
ALTER TABLE `lot_definitions`
  ADD CONSTRAINT `lot_definitions_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_branch_id`) REFERENCES `branch` (`branch_id`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`shipment_id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`),
  ADD CONSTRAINT `order_items_ibfk_3` FOREIGN KEY (`lot_id`) REFERENCES `lot_definitions` (`lot_id`);

--
-- Constraints for table `product`
--
ALTER TABLE `product`
  ADD CONSTRAINT `product_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `product_category` (`category_id`);

--
-- Constraints for table `returns`
--
ALTER TABLE `returns`
  ADD CONSTRAINT `returns_ibfk_1` FOREIGN KEY (`original_order_id`) REFERENCES `orders` (`order_id`);

--
-- Constraints for table `return_items`
--
ALTER TABLE `return_items`
  ADD CONSTRAINT `return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `returns` (`return_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `return_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`);

--
-- Constraints for table `route_stops`
--
ALTER TABLE `route_stops`
  ADD CONSTRAINT `route_stops_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `route_stops_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branch_id`);

--
-- Constraints for table `shipments`
--
ALTER TABLE `shipments`
  ADD CONSTRAINT `fk_shipment_sales` FOREIGN KEY (`sales_emp_id`) REFERENCES `employees` (`emp_id`),
  ADD CONSTRAINT `shipments_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`),
  ADD CONSTRAINT `shipments_ibfk_2` FOREIGN KEY (`car_id`) REFERENCES `cars` (`car_id`),
  ADD CONSTRAINT `shipments_ibfk_3` FOREIGN KEY (`driver_emp_id`) REFERENCES `employees` (`emp_id`);

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`stock_id`) REFERENCES `inventory_stock` (`stock_id`),
  ADD CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`performed_by_emp_id`) REFERENCES `employees` (`emp_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
