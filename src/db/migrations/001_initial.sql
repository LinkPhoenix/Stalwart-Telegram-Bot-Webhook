CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  data JSON,
  source_ip VARCHAR(45),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  event_id VARCHAR(255),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_ip_event (ip, event_id),
  INDEX idx_ip (ip),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS whitelisted_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(128) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_event_ip (event_type, ip),
  INDEX idx_event_type (event_type)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_user_event (user_id, event_type),
  INDEX idx_user_id (user_id),
  INDEX idx_event_type (event_type)
);
