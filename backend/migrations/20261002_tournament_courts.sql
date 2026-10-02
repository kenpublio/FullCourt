-- Restrict each newly created tournament's scheduler to its organizer-selected courts.
CREATE TABLE IF NOT EXISTS tournament_courts (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, court_id)
);
CREATE INDEX IF NOT EXISTS tournament_courts_court_id_idx ON tournament_courts(court_id);
