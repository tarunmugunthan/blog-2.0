# blog-2.0
Launching a test blog app

# Lightweight Blog App

A full-stack blog application built with lightweight frameworks and minimal dependencies.

## Features

### Frontend (Public Blog)
- **Homepage** with featured posts and all posts listing
- **Search functionality** - search through titles, content, and excerpts
- **Category filtering** - filter posts by category
- **Responsive design** - works on desktop and mobile
- **SEO-friendly URLs** - `/post/post-slug` format
- **Clean, modern UI** with smooth animations

### Admin Panel (CMS)
- **Secure admin login** at `/admin`
- **Rich text editor** (Quill.js) with formatting, images, links, and embeds
- **Post management** - create, edit, delete posts
- **Image upload** functionality
- **Post metadata** - title, excerpt, author, category, tags
- **Featured posts** - mark posts as featured for homepage
- **Draft/Published status** control
- **Responsive admin interface**

## Tech Stack

- **Backend**: Node.js + Express (lightweight web server)
- **Database**: SQLite (file-based, no setup required)
- **Frontend**: Vanilla JavaScript (no framework overhead)
- **Editor**: Quill.js (lightweight rich text editor)
- **Authentication**: Session-based with bcrypt password hashing
- **File Upload**: Multer for image handling

## Quick Start

### 1. Clone or Download Files
Create a new directory and save these files:
- `app.js` (server file)
- `package.json` (dependencies)
- Create `public/` folder and save:
  - `index.html` (main blog)
  - `admin.html` (admin panel)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Application
```bash
npm start
# or for development with auto-restart:
npm run dev
```

### 4. Access the Application
- **Blog**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Default Admin Credentials**: 
  - Username: `admin`
  - Password: `admin123`

## Project Structure

```
blog-app/
├── app.js              # Express server
├── package.json        # Dependencies
├── blog.db            # SQLite database (created automatically)
├── uploads/           # Uploaded images (created automatically)
└── public/
    ├── index.html     # Public blog frontend
    └── admin.html     # Admin CMS panel
```

## Usage

### Creating Posts
1. Go to http://localhost:3000/admin
2. Login with admin credentials
3. Click "New Post" 
4. Fill in the post details:
   - **Title**: Required, auto-generates URL slug
   - **Excerpt**: Short description for post previews
   - **Content**: Rich text with formatting, images, links
   - **Author**: Author name
   - **Category**: Post category for filtering
   - **Tags**: Comma-separated tags
   - **Featured Image**: Upload or enter image URL
   - **Featured**: Check to show on homepage featured section
   - **Published**: Uncheck to save as draft

### Managing Posts
- **All Posts**: View all posts with status indicators
- **Edit**: Click edit button on any post
- **Delete**: Click delete with confirmation
- **Status**: Published posts appear on blog, drafts are hidden

### Blog Features
- **Search**: Enter keywords to search titles, content, excerpts
- **Filter**: Select category to filter posts
- **Featured Posts**: Top 3 featured posts shown prominently
- **Post URLs**: Clean URLs like `/post/my-post-title`
- **Responsive**: Works on all device sizes

## Customization

### Styling
- Edit the `<style>` sections in `index.html` and `admin.html`
- Colors, fonts, layouts are all customizable via CSS

### Database Schema
The app automatically creates these tables:
- `users` - Admin user accounts
- `posts` - Blog posts with metadata

### Adding Features
- **Comments**: Add comments table and API endpoints
- **Multiple Authors**: Extend user system
- **Media Gallery**: Enhance file upload system
- **SEO**: Add meta tags and structured data
- **Analytics**: Integrate tracking codes

## Deployment

### Local Production
```bash
# Install production dependencies only
npm install --production
# Run in production mode
NODE_ENV=production npm start
```

### Cloud Deployment
Works on any Node.js hosting platform:
- **Heroku**: Add Procfile with `web: node app.js`
- **Railway**: Auto-deploys from Git
- **DigitalOcean Apps**: Deploy directly from repo
- **AWS/Google Cloud**: Use their Node.js runtimes

### Environment Variables
For production, set:
```bash
NODE_ENV=production
PORT=3000  # or your preferred port
SESSION_SECRET=your-secure-secret-key
```

## Security Notes

### For Production Use:
1. **Change default admin password** immediately
2. **Set secure session secret** in `app.js`
3. **Use HTTPS** in production
4. **Add rate limiting** for login attempts
5. **Validate file uploads** more strictly
6. **Add input sanitization** for XSS protection

### Current Security Features:
- Password hashing with bcrypt
- Session-based authentication
- File upload restrictions
- SQL injection protection (parameterized queries)

## Performance

- **Lightweight**: Minimal dependencies, fast startup
- **Efficient**: SQLite for quick reads, cached static files
- **Scalable**: Can handle thousands of posts efficiently
- **SEO-Friendly**: Server-side rendering, clean URLs

## Troubleshooting

### Common Issues:
- **Port in use**: Change PORT in app.js or kill existing process
- **Database issues**: Delete `blog.db` to reset (loses data)
- **Upload failures**: Check `uploads/` directory permissions
- **Login issues**: Clear browser cookies and try again

### Development:
- Use `npm run dev` for auto-restart on file changes
- Check console logs for detailed error messages
- Database file `blog.db` stores all data locally

## API Endpoints

### Public API
- `GET /api/posts` - Get all published posts (supports ?search, ?category, ?featured)
- `GET /api/posts/featured` - Get featured posts
- `GET /api/posts/:slug` - Get single post by slug
- `GET /api/categories` - Get all categories

### Admin API (requires authentication)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/check` - Check authentication status
- `GET /api/admin/posts` - Get all posts (including drafts)
- `GET /api/admin/posts/:id` - Get single post by ID
- `POST /api/admin/posts` - Create new post
- `PUT /api/admin/posts/:id` - Update post
- `DELETE /api/admin/posts/:id` - Delete post
- `POST /api/admin/upload` - Upload image

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
);
```

### Posts Table
```sql
CREATE TABLE posts (
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
);
```

## Advanced Configuration

### Custom Port
Change the port in `app.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

### Session Configuration
Update session settings in `app.js`:
```javascript
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
```

### File Upload Limits
Modify multer configuration in `app.js`:
```javascript
const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});
```

## Extensions and Integrations

### Adding Comments
1. Create comments table in database
2. Add comment API endpoints
3. Update frontend to display/submit comments

### SEO Enhancements
1. Add meta tags for social sharing
2. Generate sitemap.xml
3. Add structured data (JSON-LD)
4. Implement Open Graph tags

### Analytics Integration
Add to `index.html` before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Email Notifications
Install nodemailer: `npm install nodemailer`
Add email service for new post notifications.

## Backup and Migration

### Backup Data
```bash
# Backup database
cp blog.db blog-backup-$(date +%Y%m%d).db

# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### Export Posts
Add this endpoint to export posts as JSON:
```javascript
app.get('/api/admin/export', requireAuth, (req, res) => {
    db.all('SELECT * FROM posts', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});
```

## Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions:
1. Check this README for common solutions
2. Review the code comments for implementation details
3. Open an issue on the project repository

---

**Happy Blogging!** 🚀

This lightweight blog app gives you a solid foundation that you can easily customize and extend based on your needs.