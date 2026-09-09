const express = require('express');
const bodyParser = require('express').json;
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const queries = require('./src/queries');
const migrate = require('./scripts/migrate');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-secure-secret';

// ensure DB/migrations
migrate();

const app = express();
app.use(cors());
app.use(bodyParser());

// Simple health
app.get('/api/health', (req,res)=>res.json({ok:true}));

// Auth
app.post('/api/register', async (req,res)=>{
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing fields' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const r = await queries.run('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name||'', email, hashed]);
    const user = await queries.get('SELECT id,name,email,created_at FROM users WHERE id = ?', [r.lastID]);
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email already in use' });
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/api/login', async (req,res)=>{
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing fields' });
  try {
    const row = await queries.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });
    const user = { id: row.id, name: row.name, email: row.email };
    const token = jwt.sign({ id: row.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// Auth middleware
function auth(req,res,next){
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'missing auth' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'bad auth' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Charts CRUD
app.get('/api/charts', auth, async (req,res)=>{
  try {
    const rows = await queries.all('SELECT id,user_id,title,data,created_at,updated_at FROM charts WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    // parse JSON data field
    const parsed = rows.map(r=>({ ...r, data: r.data ? JSON.parse(r.data) : null }));
    res.json(parsed);
  } catch (err) { console.error(err); res.status(500).json({ error:'internal' }); }
});

app.post('/api/charts', auth, async (req,res)=>{
  const { title, data } = req.body;
  try {
    const dataText = data ? JSON.stringify(data) : null;
    const r = await queries.run('INSERT INTO charts (user_id,title,data) VALUES (?,?,?)', [req.userId, title||'', dataText]);
    const row = await queries.get('SELECT id,user_id,title,data,created_at,updated_at FROM charts WHERE id = ?', [r.lastID]);
    row.data = row.data ? JSON.parse(row.data) : null;
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error:'internal' }); }
});

app.get('/api/charts/:id', auth, async (req,res)=>{
  try {
    const row = await queries.get('SELECT id,user_id,title,data,created_at,updated_at FROM charts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!row) return res.status(404).json({ error:'not found' });
    row.data = row.data ? JSON.parse(row.data) : null;
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ error:'internal' }); }
});

app.put('/api/charts/:id', auth, async (req,res)=>{
  const { title, data } = req.body;
  try {
    const existing = await queries.get('SELECT id FROM charts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error:'not found' });
    const dataText = data ? JSON.stringify(data) : null;
    await queries.run('UPDATE charts SET title = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title||'', dataText, req.params.id]);
    const row = await queries.get('SELECT id,user_id,title,data,created_at,updated_at FROM charts WHERE id = ?', [req.params.id]);
    row.data = row.data ? JSON.parse(row.data) : null;
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ error:'internal' }); }
});

app.delete('/api/charts/:id', auth, async (req,res)=>{
  try {
    const existing = await queries.get('SELECT id FROM charts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error:'not found' });
    await queries.run('DELETE FROM charts WHERE id = ?', [req.params.id]);
    res.json({ ok:true });
  } catch (err) { console.error(err); res.status(500).json({ error:'internal' }); }
});

// Serve frontend static if any
const publicDir = path.join(__dirname, '.grok');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.listen(PORT, ()=>{
  console.log(`Jobharts backend listening on ${PORT}`);
});
