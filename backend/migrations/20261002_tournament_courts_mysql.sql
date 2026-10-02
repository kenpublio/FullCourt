-- MariaDB/MySQL version: tournament-specific courts used by schedule generation.
CREATE TABLE IF NOT EXISTS tournament_courts (
  tournament_id INT NOT NULL,
  court_id INT NOT NULL,
  PRIMARY KEY (tournament_id, court_id),
  KEY tournament_courts_court_id_idx (court_id),
  CONSTRAINT tournament_courts_tournament_fk FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT tournament_courts_court_fk FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
