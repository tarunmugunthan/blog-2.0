const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Initialize SQLite database
const db = new sqlite3.Database('blog.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // Posts table
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    author TEXT,
    category TEXT,
    tags TEXT,
    featured BOOLEAN DEFAULT 0,
    published BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create default admin user (username: admin, password: admin123)
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, 
    ['admin', defaultPassword]);
});

// Helper function to generate slug
function generateSlug(title) {
  return title.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes

// Get all posts with optional search and filter
app.get('/api/posts', (req, res) => {
  const { search, category, featured } = req.query;
  let query = 'SELECT * FROM posts WHERE published = 1';
  const params = [];

  if (search) {
    query += ' AND (title LIKE ? OR content LIKE ? OR excerpt LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (featured === 'true') {
    query += ' AND featured = 1';
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get featured posts
app.get('/api/posts/featured', (req, res) => {
  db.all('SELECT * FROM posts WHERE published = 1 AND featured = 1 ORDER BY created_at DESC LIMIT 3', 
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
});

// Get single post by slug
app.get('/api/posts/:slug', (req, res) => {
  db.get('SELECT * FROM posts WHERE slug = ? AND published = 1', [req.params.slug], 
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      res.json(row);
    });
});

// Get all categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM posts WHERE published = 1 AND category IS NOT NULL AND category != ""', 
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows.map(row => row.category));
    });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    req.session.userId = user.id;
    res.json({ success: true });
  });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check admin authentication
app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: !!req.session.userId });
});

// Get all posts for admin (including unpublished)
app.get('/api/admin/posts', requireAuth, (req, res) => {
  db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get single post for admin
app.get('/api/admin/posts/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(row);
  });
});

// Create new post
app.post('/api/admin/posts', requireAuth, (req, res) => {
  const { title, excerpt, content, featured_image, author, category, tags, featured, published } = req.body;
  const slug = generateSlug(title);
  
  const query = `INSERT INTO posts 
    (title, slug, excerpt, content, featured_image, author, category, tags, featured, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(query, [title, slug, excerpt, content, featured_image, author, category, tags, 
    featured ? 1 : 0, published ? 1 : 0], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, slug });
  });
});

// Update post
app.put('/api/admin/posts/:id', requireAuth, (req, res) => {
  const { title, excerpt, content, featured_image, author, category, tags, featured, published } = req.body;
  const slug = generateSlug(title);
  
  const query = `UPDATE posts 
    SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?, 
        author = ?, category = ?, tags = ?, featured = ?, published = ?, 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`;
  
  db.run(query, [title, slug, excerpt, content, featured_image, author, category, tags, 
    featured ? 1 : 0, published ? 1 : 0, req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, slug });
  });
});

// Delete post
app.delete('/api/admin/posts/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM posts WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// Upload image
app.post('/api/admin/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ 
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename 
  });
});

app.listen(PORT, () => {
  console.log(`Blog server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Default admin credentials: admin / admin123`);
});