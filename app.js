const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased for large image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

// Configure multer for file uploads with larger limits (we'll resize after upload)
const storage = multer.memoryStorage(); // Store in memory for processing

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (we'll resize down)
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Image processing function
async function processImage(buffer, originalName) {
  try {
    const fileExtension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, fileExtension);
    const timestamp = Date.now();
    const uniqueSuffix = Math.round(Math.random() * 1E9);
    
    // Generate filename - prefer WebP for best compression
    const outputFilename = `${timestamp}-${uniqueSuffix}-${baseName}.webp`;
    const outputPath = path.join('uploads', outputFilename);
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    let sharpInstance = sharp(buffer);
    
    // Determine optimal resize dimensions
    const maxWidth = 1920;  // Max width for blog images
    const maxHeight = 1080; // Max height for blog images
    const targetQuality = 85; // Good balance of quality/size
    
    // Resize if image is too large
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit: 'inside', // Maintain aspect ratio
        withoutEnlargement: true // Don't upscale smaller images
      });
    }
    
    // Convert to WebP for optimal compression and quality
    await sharpInstance
      .webp({ 
        quality: targetQuality,
        effort: 6 // Higher effort = better compression
      })
      .toFile(outputPath);
    
    // Get file size info
    const stats = await fs.promises.stat(outputPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    console.log(`Image processed: ${originalName} -> ${outputFilename}`);
    console.log(`Original: ${metadata.width}x${metadata.height}, Final size: ${fileSizeKB}KB`);
    
    return {
      filename: outputFilename,
      originalName: originalName,
      size: stats.size,
      width: metadata.width > maxWidth ? maxWidth : metadata.width,
      height: metadata.height > maxHeight ? maxHeight : metadata.height
    };
    
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image. Please try a different image.');
  }
}

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

// Upload image with automatic processing
app.post('/api/admin/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Process the image (resize, optimize, convert to WebP)
    const processedImage = await processImage(req.file.buffer, req.file.originalname);
    
    res.json({ 
      url: `/uploads/${processedImage.filename}`,
      filename: processedImage.filename,
      originalName: processedImage.originalName,
      size: processedImage.size,
      dimensions: `${processedImage.width}x${processedImage.height}`,
      message: 'Image uploaded and optimized successfully'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to upload and process image'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Blog server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Default admin credentials: admin / admin123`);
});