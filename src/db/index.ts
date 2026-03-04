import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('puppy.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puppy_name TEXT NOT NULL,
    puppy_age_weeks INTEGER DEFAULT 8,
    invite_code TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    family_id INTEGER,
    FOREIGN KEY(family_id) REFERENCES families(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    task_index INTEGER NOT NULL,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(family_id) REFERENCES families(id),
    UNIQUE(family_id, date, task_index)
  );

  CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    content TEXT NOT NULL,
    FOREIGN KEY(family_id) REFERENCES families(id),
    UNIQUE(family_id, date)
  );
`);

// Migration for multiple puppies
const hasPuppiesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='puppies'").get();
if (!hasPuppiesTable) {
  db.exec(`
    CREATE TABLE puppies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      breed TEXT,
      age_weeks INTEGER DEFAULT 8,
      photo_url TEXT,
      FOREIGN KEY(family_id) REFERENCES families(id)
    );
    CREATE TABLE puppy_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puppy_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      task_index INTEGER NOT NULL,
      completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(puppy_id) REFERENCES puppies(id),
      UNIQUE(puppy_id, date, task_index)
    );
    CREATE TABLE puppy_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puppy_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY(puppy_id) REFERENCES puppies(id),
      UNIQUE(puppy_id, date)
    );
  `);
  
  // Migrate data
  const families = db.prepare('SELECT * FROM families').all() as any[];
  for (const f of families) {
    const res = db.prepare('INSERT INTO puppies (family_id, name, age_weeks) VALUES (?, ?, ?)').run(f.id, f.puppy_name || 'Winnie', f.puppy_age_weeks || 8);
    const puppyId = res.lastInsertRowid;
    
    // Migrate tasks
    const tasks = db.prepare('SELECT * FROM tasks WHERE family_id = ?').all(f.id) as any[];
    for (const t of tasks) {
      db.prepare('INSERT INTO puppy_tasks (puppy_id, date, task_index, completed_at) VALUES (?, ?, ?, ?)').run(puppyId, t.date, t.task_index, t.completed_at);
    }
    
    // Migrate tips
    const tips = db.prepare('SELECT * FROM tips WHERE family_id = ?').all(f.id) as any[];
    for (const t of tips) {
      db.prepare('INSERT INTO puppy_tips (puppy_id, date, content) VALUES (?, ?, ?)').run(puppyId, t.date, t.content);
    }
  }
}

export default db;
