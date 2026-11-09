import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import potsRoutes from './routes/potsRoutes.js';
import remittanceRoutes from './routes/remittanceRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import { sanitizeInputs } from './middlewares/validationMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Mount modular routes
app.use('/api/auth', authRoutes);
app.use('/api/pots', potsRoutes);
app.use('/api/remittance', remittanceRoutes);
app.use('/api/market', marketRoutes);

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
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
    },
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Security Alert / Error] ${err.message}`);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal security exception',
  });
});

app.listen(PORT, () => {
  console.log(`[Security] AssetBridge hardened API running on port ${PORT}`);
});

export default app;
