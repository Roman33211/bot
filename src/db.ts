import Database from 'better-sqlite3';

const db = new Database('visualica.db', { timeout: 5000 });

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    name TEXT,
    company TEXT,
    role TEXT,
    sku_count TEXT,
    preferred_time TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_states (
    telegram_id TEXT PRIMARY KEY,
    state TEXT,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS admins (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT,
    answer TEXT,
    slug TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations: Add columns if they don't exist
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Added column ${column} to ${table}`);
  } catch (err: any) {
    if (err.message.includes('duplicate column name')) {
      // Column already exists, ignore
    } else {
      console.error(`Error adding column ${column}:`, err.message);
    }
  }
};

addColumn('leads', 'notes', 'TEXT');
addColumn('leads', 'source', 'TEXT');
addColumn('leads', 'assigned_to', 'TEXT');

export default db;
