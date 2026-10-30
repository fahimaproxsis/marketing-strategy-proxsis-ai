const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Initialize SQLite database
const db = new Database(path.join(dataDir, 'marketing.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    data       TEXT    NOT NULL,
    saved_at   TEXT    NOT NULL,
    saved_by   TEXT    DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT,
    field       TEXT,
    old_value   TEXT,
    new_value   TEXT,
    description TEXT,
    changed_at  TEXT NOT NULL
  );
`);

app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Serve index.html as static
app.use(express.static(__dirname, { index: 'index.html' }));

// ─── API: Get latest snapshot ───────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  try {
    const row = db.prepare(
      'SELECT * FROM snapshots ORDER BY id DESC LIMIT 1'
    ).get();
    if (!row) return res.json(null);
    res.json(JSON.parse(row.data));
  } catch (e) {
    res.status(500).json({ error: 'Gagal membaca data: ' + e.message });
  }
});

// ─── API: Save snapshot ──────────────────────────────────────────────────────
app.post('/api/data', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.tasks) {
      return res.status(400).json({ error: 'Data tidak valid' });
    }
    const now = new Date().toISOString();
    data.saved_at = now;
    const json = JSON.stringify(data);

    const stmt = db.prepare(
      'INSERT INTO snapshots (data, saved_at, saved_by) VALUES (?, ?, ?)'
    );
    const result = stmt.run(json, now, data.saved_by || 'user');

    // Keep only the last 100 snapshots
    db.prepare(
      'DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 100)'
    ).run();

    res.json({ ok: true, id: result.lastInsertRowid, saved_at: now });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menyimpan: ' + e.message });
  }
});

// ─── API: Get history (last 100 changes) ────────────────────────────────────
app.get('/api/history', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM history ORDER BY id DESC LIMIT 100'
    ).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Log a history entry ────────────────────────────────────────────────
app.post('/api/history', (req, res) => {
  try {
    const { task_id, field, old_value, new_value, description } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO history (task_id, field, old_value, new_value, description, changed_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      task_id   || null,
      field     || null,
      old_value !== undefined ? String(old_value) : null,
      new_value !== undefined ? String(new_value) : null,
      description || null,
      now
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Get snapshot list (for history UI) ─────────────────────────────────
app.get('/api/snapshots', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT id, saved_at, saved_by FROM snapshots ORDER BY id DESC LIMIT 30'
    ).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Marketing Strategy Server berjalan di port ${PORT}`);
});
