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

  CREATE TABLE IF NOT EXISTS puppy_naps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puppy_id INTEGER NOT NULL,
    start_time TEXT NOT NULL, -- HH:MM
    end_time TEXT NOT NULL, -- HH:MM
    day_of_week INTEGER NOT NULL, -- 0-6
    FOREIGN KEY(puppy_id) REFERENCES puppies(id)
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
    CREATE TABLE puppy_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puppy_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      task TEXT NOT NULL,
      desc TEXT NOT NULL,
      demo_url TEXT,
      demo_type TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY(puppy_id) REFERENCES puppies(id)
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

// Migration for puppy_schedule
const hasPuppyScheduleTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='puppy_schedule'").get();
if (!hasPuppyScheduleTable) {
  db.exec(`
    CREATE TABLE puppy_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puppy_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      task TEXT NOT NULL,
      desc TEXT NOT NULL,
      demo_url TEXT,
      demo_type TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY(puppy_id) REFERENCES puppies(id)
    );
  `);

  // Insert default schedule for existing puppies
  const defaultSchedule = [
    { time: "07:00", task: "Immediate Out", desc: "Carry to grass immediately. No walking!", demo_url: "https://media.giphy.com/media/3o7abAHdYvZdBNkDAS/giphy.gif", demo_type: 'gif' },
    { time: "07:15", task: "Breakfast", desc: "Feed inside the crate for positive vibes." },
    { time: "07:35", task: "Potty Break #2", desc: "The post-breakfast ritual." },
    { time: "08:00", task: "Nap Time", desc: "Mandatory 2-hour crate nap." },
    { time: "10:00", task: "Wake & Potty", desc: "Carry out again." },
    { time: "10:15", task: "Play & Train", desc: "15 mins of tug or basic commands." },
    { time: "11:00", task: "Nap Time", desc: "Back in the crate." },
    { time: "13:00", task: "Lunch & Potty", desc: "Midday meal and break." },
    { time: "14:00", task: "Nap Time", desc: "Rest is crucial for growth." },
    { time: "16:00", task: "Wake & Potty", desc: "Afternoon break." },
    { time: "16:30", task: "Socialization", desc: "Expose to new sounds/sights safely." },
    { time: "17:30", task: "Dinner", desc: "Last meal of the day." },
    { time: "18:00", task: "Potty Break", desc: "Post-dinner outing." },
    { time: "19:00", task: "Wind Down", desc: "Calm chewing or cuddling." },
    { time: "20:00", task: "Final Potty & Bed", desc: "Lights out in the crate." }
  ];

  const puppies = db.prepare('SELECT id FROM puppies').all() as any[];
  const insertStmt = db.prepare('INSERT INTO puppy_schedule (puppy_id, time, task, desc, demo_url, demo_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const p of puppies) {
    defaultSchedule.forEach((item, index) => {
      insertStmt.run(p.id, item.time, item.task, item.desc, item.demo_url || null, item.demo_type || null, index);
    });
  }
}

export default db;
