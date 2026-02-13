-- =============================================
-- WhatsApp Gateway Multi-Device Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS wa_gateway;
USE wa_gateway;

-- Devices table
CREATE TABLE IF NOT EXISTS wa_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  api_key VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(50) DEFAULT NULL,
  status ENUM('disconnected','connecting','connected') DEFAULT 'disconnected',
  auto_reply BOOLEAN DEFAULT FALSE,
  auto_reply_prompt TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Message Queue table
CREATE TABLE IF NOT EXISTS wa_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  target VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  delay_ms INT DEFAULT 5000,
  status ENUM('pending','processing','sent','failed') DEFAULT 'pending',
  error TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_device_status (device_id, status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Outbox / Sent Log table
CREATE TABLE IF NOT EXISTS wa_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  target VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  wa_message_id VARCHAR(200) DEFAULT NULL,
  status ENUM('SENT','DELIVERED','READ','FAILED') DEFAULT 'SENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device (device_id),
  INDEX idx_wa_msg_id (wa_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
