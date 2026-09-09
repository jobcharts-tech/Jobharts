const db = require('../src/db');

// Create the tables if they don't exist
const sqlUsers = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const sqlCharts = `
CREATE TABLE IF NOT EXISTS charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

function migrate() {
  db.serialize(() => {
    db.run(sqlUsers);
    db.run(sqlCharts);
  });
}

if (require.main === module) {
  migrate();
  console.log('Migration complete.');
}

module.exports = migrate;
