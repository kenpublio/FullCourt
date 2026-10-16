CREATE TABLE IF NOT EXISTS tournament_staff_assignments (
  tournament_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assignment_role VARCHAR(20) NOT NULL DEFAULT 'primary',
  assigned_by INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tournament_id, user_id),
  CONSTRAINT fk_tournament_staff_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_staff_assigner FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

