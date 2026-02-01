const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const si = require('systeminformation');
const db = require('./database');

// Helper for audit logs
function logAction(action, details, userId, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.prepare('INSERT INTO audit_logs (action, details, user_id, ip_address) VALUES (?, ?, ?, ?)').run(action, details, userId, ip);
}

// Background task to delete expired files
setInterval(() => {
    const now = new Date().toISOString();
    const expiredFiles = db.prepare('SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < ?').all(now);
    for (const file of expiredFiles) {
        const filePath = path.join(__dirname, 'uploads', file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        console.log(`Deleted expired file: ${file.original_name}`);
    }
}, 60000); // Check every minute

const app = express();
const port = 3000;

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: () => {
            const limit = db.prepare('SELECT value FROM settings WHERE key = ?').get('max_upload_size');
            return limit ? parseInt(limit.value) * 1024 * 1024 : 100 * 1024 * 1024; // Default 100MB
        }
    }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'jads-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Setup Middleware
app.use((req, res, next) => {
    try {
        const isSetup = db.prepare('SELECT value FROM settings WHERE key = ?').get('is_setup');
        if (!isSetup && req.path !== '/setup') {
            return res.redirect('/setup');
        }
        
        // Maintenance Mode Check
        const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode');
        if (maintenance && maintenance.value === 'true' && !req.path.startsWith('/admin') && !req.path.startsWith('/dashboard') && !req.path.startsWith('/login') && req.path !== '/setup' && !req.session.user) {
            // Check if it's a public download link (everything else basically)
            const slug = req.path.substring(1);
            if (slug && !['dashboard', 'login', 'setup', 'logout', 'upload', 'add-user'].includes(slug.split('/')[0])) {
                 return res.status(503).send('System is under maintenance. Please try again later.');
            }
        }
    } catch (e) {
        // Table might not exist yet if database.js failed for some reason
        if (req.path !== '/setup') return res.redirect('/setup');
    }
    next();
});

// Auth Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/login');
};

// --- Routes ---

// Setup
app.get('/setup', (req, res) => {
    const isSetup = db.prepare('SELECT value FROM settings WHERE key = ?').get('is_setup');
    if (isSetup) return res.redirect('/');
    res.render('setup');
});

app.post('/setup', async (req, res) => {
    const { baseDomain, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.transaction(() => {
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('base_domain', baseDomain);
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('is_setup', 'true');
        db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, 'Admin');
    })();
    
    res.redirect('/login');
});

// Auth
app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        logAction('Login', 'Successful login', user.id, req);
        return res.redirect('/dashboard');
    }
    logAction('Login Failed', `Failed login attempt for username: ${username}`, null, req);
    res.render('login', { error: 'Invalid credentials' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard
app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    let files;
    if (user.role === 'Admin' || user.role === 'Manager') {
        files = db.prepare('SELECT files.*, users.username as uploader FROM files LEFT JOIN users ON files.user_id = users.id').all();
    } else {
        files = db.prepare('SELECT files.*, users.username as uploader FROM files LEFT JOIN users ON files.user_id = users.id WHERE user_id = ?').all(user.id);
    }
    const users = user.role === 'Admin' ? db.prepare('SELECT id, username, role FROM users').all() : [];
    const baseDomain = db.prepare('SELECT value FROM settings WHERE key = ?').get('base_domain').value;
    
    // System Health
    const mem = await si.mem();
    const cpu = await si.currentLoad();
    const fsSize = await si.fsSize();
    const uploadsPath = path.join(__dirname, 'uploads');
    const disk = fsSize.find(f => uploadsPath.startsWith(f.mount)) || fsSize[0];
    
    const health = {
        mem: {
            used: (mem.active / 1024 / 1024 / 1024).toFixed(2),
            total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
            percent: ((mem.active / mem.total) * 100).toFixed(0)
        },
        cpu: cpu.currentLoad.toFixed(0),
        disk: {
            used: (disk.used / 1024 / 1024 / 1024).toFixed(2),
            total: (disk.size / 1024 / 1024 / 1024).toFixed(2),
            percent: disk.use.toFixed(0)
        },
        uptime: {
            days: Math.floor(process.uptime() / 86400),
            hours: Math.floor((process.uptime() % 86400) / 3600),
            minutes: Math.floor((process.uptime() % 3600) / 60)
        }
    };

    const auditLogs = user.role === 'Admin' ? db.prepare('SELECT audit_logs.*, users.username FROM audit_logs LEFT JOIN users ON audit_logs.user_id = users.id ORDER BY timestamp DESC LIMIT 50').all() : [];
    const maintenanceMode = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode')?.value === 'true';
    const maxUploadSize = db.prepare('SELECT value FROM settings WHERE key = ?').get('max_upload_size')?.value || '100';

    res.render('dashboard', { user, files, users, baseDomain, health, auditLogs, maintenanceMode, maxUploadSize });
});

// File Management
app.post('/upload', isAuthenticated, upload.single('file'), (req, res) => {
    if (!req.file) return res.redirect('/dashboard');
    
    const { expiry } = req.body;
    let expiresAt = null;
    if (expiry) {
        expiresAt = new Date(Date.now() + parseInt(expiry) * 60 * 60 * 1000).toISOString();
    }

    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const checksum = hashSum.digest('hex');

    db.prepare('INSERT INTO files (original_name, filename, slug, user_id, checksum, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.file.originalname, req.file.filename, req.file.originalname, req.session.user.id, checksum, expiresAt);
    
    logAction('File Upload', `Uploaded file: ${req.file.originalname}`, req.session.user.id, req);
    res.redirect('/dashboard');
});

app.post('/update-slug/:id', isAuthenticated, (req, res) => {
    const { slug } = req.body;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    
    if (!file) return res.redirect('/dashboard');
    
    // RBAC: Check if user has permission
    const user = req.session.user;
    if (user.role !== 'Admin' && user.role !== 'Manager' && file.user_id !== user.id) {
        return res.status(403).send('Unauthorized');
    }
    
    try {
        db.prepare('UPDATE files SET slug = ? WHERE id = ?').run(slug, req.params.id);
        logAction('Update Slug', `Updated slug for ${file.original_name} to ${slug}`, user.id, req);
    } catch (e) {
        // Slug must be unique
    }
    res.redirect('/dashboard');
});

app.get('/delete-file/:id', isAuthenticated, (req, res) => {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!file) return res.redirect('/dashboard');
    
    const user = req.session.user;
    if (user.role !== 'Admin' && user.role !== 'Manager' && file.user_id !== user.id) {
        return res.status(403).send('Unauthorized');
    }
    
    const filePath = path.join(__dirname, 'uploads', file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
    logAction('Delete File', `Deleted file: ${file.original_name}`, user.id, req);
    res.redirect('/dashboard');
});

// User Management (Admin only)
app.post('/add-user', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'Admin') return res.status(403).send('Unauthorized');
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role);
        logAction('Add User', `Added user: ${username} with role ${role}`, req.session.user.id, req);
    } catch (e) {}
    res.redirect('/dashboard');
});

app.get('/delete-user/:id', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'Admin') return res.status(403).send('Unauthorized');
    if (parseInt(req.params.id) === req.session.user.id) return res.redirect('/dashboard');
    
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.redirect('/dashboard');

    db.transaction(() => {
        // Option A: Assign files to the admin who deleted the user, or just set to NULL (handled by FK)
        // We let the FK SET NULL handle files and logs, but we could also delete files if we wanted.
        // For now, let's just proceed with deletion as the FK is now configured.
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    })();
    
    logAction('Delete User', `Deleted user: ${targetUser.username}`, req.session.user.id, req);
    res.redirect('/dashboard');
});

// Settings management (Admin only)
app.post('/update-settings', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'Admin') return res.status(403).send('Unauthorized');
    const { maintenanceMode, maxUploadSize } = req.body;
    
    db.transaction(() => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('maintenance_mode', maintenanceMode === 'on' ? 'true' : 'false');
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('max_upload_size', maxUploadSize);
    })();
    
    logAction('Update Settings', `Updated global settings`, req.session.user.id, req);
    res.redirect('/dashboard');
});

// Public Mirror Functionality
app.get('/:slug', (req, res) => {
    const file = db.prepare('SELECT * FROM files WHERE slug = ?').get(req.params.slug);
    if (file) {
        const filePath = path.join(__dirname, 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
            db.prepare('UPDATE files SET downloads = downloads + 1 WHERE id = ?').run(file.id);
            return res.download(filePath, file.original_name);
        }
    }
    res.status(404).send('File not found');
});

app.listen(port, () => console.log(`JADS running on http://localhost:${port}`));
