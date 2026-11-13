import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSupabaseConfigured } from './services/supabaseService.js';
import authRoutes from './routes/authRoutes.js';
import potsRoutes from './routes/potsRoutes.js';
import remittanceRoutes from './routes/remittanceRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import { sanitizeInputs } from './middlewares/validationMiddleware.js';

// supabaseService loads server/.env relative to its own file location.
// Keep this call for server settings when starting from the server directory.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const WEB_DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../AssetBridge/dist');

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*", "https://*.supabase.co"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Hide server implementation details
app.disable('x-powered-by');

// 2. Strict CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Access denied from unauthorized origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 3. Payload size limiting (DoS mitigation)
app.use(express.json({ limit: '15kb' }));
app.use(express.urlencoded({ extended: true, limit: '15kb' }));

// 4. Sanitize inputs
app.use(sanitizeInputs);

// 5. Global API Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});
app.use('/api', globalLimiter);

// 6. Strict Rate Limiting for Authentication (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many login attempts. Account temporarily locked for 15 minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/admin-login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// Mount modular routes
app.use('/api/auth', authRoutes);
app.use('/api/pots', potsRoutes);
app.use('/api/stokvels', potsRoutes);
app.use('/api/remittance', remittanceRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/claims', claimRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    project: 'AssetBridge Secure Backend API',
    security: {
      helmet: 'enabled',
      rateLimiting: 'active',
      cors: 'whitelisted',
      payloadProtection: 'active (15kb max)',
      supabaseConfigured: isSupabaseConfigured(),
    },
    timestamp: new Date().toISOString(),
  });
});

// In Render production, serve the Vite web app from the same origin as the API.
// This keeps VITE_API_URL same-origin and avoids wildcard CORS configuration.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(WEB_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(WEB_DIST_DIR, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Security Alert / Error] ${err.message}`);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal security exception',
  });
});

const isTesting = process.env.NODE_ENV === 'test' ||
  process.argv.includes('--test') ||
  process.execArgv.includes('--test') ||
  (Boolean(process.argv[1]) && process.argv[1].includes('test'));

if (!isTesting) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Security] AssetBridge hardened API running on http://0.0.0.0:${PORT}`);
    if (isSupabaseConfigured()) {
      console.log('[Config] Supabase environment variables loaded.');
    } else {
      console.warn('[Config] Supabase is not configured. Set a real SUPABASE_URL and SUPABASE_ANON_KEY in server/.env; authentication will remain unavailable.');
    }
  });
}

export default app;
