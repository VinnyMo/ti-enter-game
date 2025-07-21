const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "static.cloudflareinsights.com",
        "https://static.cloudflareinsights.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "cloudflareinsights.com", "https://cloudflareinsights.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - PATH: ${req.path}`);
  next();
});

// WASM file routes moved to before catch-all route below

// Add a catch-all for any /emulator* request to debug
app.all('/emulator*', (req, res, next) => {
  console.log('*** ANY /emulator* request ***', req.method, req.url);
  next();
});

app.use('/programs', express.static('tihle-master/out/programs'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename for .8xp files
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept .8xp (TI-83 Plus) and .83p (TI-83) files
    if (file.mimetype === 'application/octet-stream' || 
        file.originalname.endsWith('.8xp') || 
        file.originalname.endsWith('.83p')) {
      cb(null, true);
    } else {
      cb(new Error('Only .8xp and .83p files are allowed'), false);
    }
  }
});

// Routes - serve main page for both root and any path
app.get('/', (req, res) => {
  console.log('Serving main page for root');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});


// Static middleware for /emulator handles this automatically

// Upload endpoint for custom programs
app.post('/upload-program', upload.single('program'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  console.log('Program uploaded:', req.file.filename);
  res.json({ 
    message: 'Program uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname
  });
});

// Get list of uploaded programs
app.get('/programs', (req, res) => {
  const uploadDir = 'uploads';
  if (!fs.existsSync(uploadDir)) {
    return res.json([]);
  }
  
  const files = fs.readdirSync(uploadDir)
    .filter(file => file.endsWith('.8xp') || file.endsWith('.83p'))
    .map(file => ({
      name: file,
      path: `/uploads/${file}`,
      uploadDate: fs.statSync(path.join(uploadDir, file)).mtime
    }));
    
  res.json(files);
});

// Serve uploaded programs
app.use('/uploads', express.static('uploads'));

// Serve WASM files (moved here to be after other routes but before catch-all)
app.get('/tihle.js', (req, res) => {
  console.log('*** HIT TIHLE.JS ROUTE - Serving tihle.js ***');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'tihle-master/out/web/tihle.js'));
});
app.get('/tihle.wasm', (req, res) => {
  console.log('*** Serving tihle.wasm (after other routes) ***');
  res.setHeader('Content-Type', 'application/wasm');
  res.sendFile(path.join(__dirname, 'tihle-master/out/web/tihle.wasm'));
});
app.get('/tihle.data', (req, res) => {
  console.log('*** Serving tihle.data (after other routes) ***');
  res.sendFile(path.join(__dirname, 'tihle-master/out/web/tihle.data'));
});
app.get('/GAME.8xp', (req, res) => {
  console.log('*** HIT GAME.8XP ROUTE - Serving GAME.8xp ***');
  const filePath = path.join(__dirname, 'GAME.8xp');
  console.log('File path:', filePath);
  
  // Check if file exists
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    console.log('GAME.8xp file exists, serving...');
    res.sendFile(filePath);
  } else {
    console.log('GAME.8xp file does not exist!');
    res.status(404).send('Game file not found');
  }
});

// Handle any other path by serving the main page (for nginx proxying)
app.get('*', (req, res) => {
  console.log('Serving main page for path:', req.url);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`TI Emulator Server running on port ${PORT}`);
  console.log(`Main page: http://localhost:${PORT}`);
  console.log(`Game: http://localhost:${PORT}/ti-emulator`);
});