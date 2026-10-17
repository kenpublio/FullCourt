CREATE TABLE IF NOT EXISTS schedule_change_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_id INTEGER NOT NULL,
  previous_start DATETIME NULL,
  new_start DATETIME NOT NULL,
  previous_court_id INTEGER NULL,
  new_court_id INTEGER NULL,
  reason VARCHAR(500) NOT NULL,
  changed_by INTEGER NOT NULL,
  coaches_notified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_history_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

