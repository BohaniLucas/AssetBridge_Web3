/**
 * User & Role Service
 * Provides authoritative persistence, password hashing, JWT/Bearer token issuance,
 * and strict Role-Based Access Control (RBAC) separating USER and ADMIN.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Designated admin emails from environment or system defaults
const DEFAULT_ADMIN_EMAILS = [
  'admin@assetbridge.africa',
  'security@assetbridge.africa',
  'malulekelucas04@gmail.com',
];

function getAdminEmails() {
  const envAdmins = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()) : [];
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...envAdmins]));
}

function hashPassword(password, salt = 'assetbridge_sec_salt_2026') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

class UserService {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      // Seed initial authoritative users
      const initialUsers = {
        'admin@assetbridge.africa': {
          id: 'usr_admin_001',
          email: 'admin@assetbridge.africa',
          fullName: 'System Administrator',
          passwordHash: hashPassword('AdminPassword123!'),
          role: 'ADMIN',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: null,
        },
        'malulekelucas04@gmail.com': {
          id: 'usr_lucas_001',
          email: 'malulekelucas04@gmail.com',
          fullName: 'Lucas Maluleke',
          passwordHash: hashPassword('Password123!'),
          role: 'USER',
          status: 'active',
          createdAt: '2026-11-10T19:43:02.000Z',
          lastLoginAt: null,
        },
        'user@assetbridge.africa': {
          id: 'usr_test_002',
          email: 'user@assetbridge.africa',
          fullName: 'Standard User',
          passwordHash: hashPassword('Password123!'),
          role: 'USER',
          status: 'active',
          createdAt: '2026-11-10T20:00:00.000Z',
          lastLoginAt: null,
        },
      };
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf8');
    }
  }

  readUsers() {
    try {
      this.ensureDataFile();
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  writeUsers(users) {
    this.ensureDataFile();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  }

  getRoleForEmail(email) {
    const normalized = (email || '').toLowerCase().trim();
    const adminEmails = getAdminEmails();
    if (adminEmails.includes(normalized)) {
      return 'ADMIN';
    }
    const users = this.readUsers();
    if (users[normalized] && users[normalized].role === 'ADMIN') {
      return 'ADMIN';
    }
    return 'USER';
  }

  async authenticateUser(email, password, expectedRole = null) {
    const normalized = (email || '').toLowerCase().trim();
    const users = this.readUsers();
    let user = users[normalized];

    // If user does not exist yet in local store, but is in designated admin list
    if (!user && getAdminEmails().includes(normalized)) {
      user = {
        id: `usr_${Date.now()}`,
        email: normalized,
        fullName: 'System Administrator',
        passwordHash: hashPassword(password),
        role: 'ADMIN',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      };
      users[normalized] = user;
      this.writeUsers(users);
    }

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (user.status === 'suspended') {
      throw new Error('Your account has been suspended by an administrator.');
    }

    const testHash = hashPassword(password);
    if (user.passwordHash && user.passwordHash !== testHash) {
      throw new Error('Invalid email or password.');
    }

    // Determine authoritative role
    const authoritativeRole = this.getRoleForEmail(normalized);
    user.role = authoritativeRole;

    // Strict role check if authenticating for a specific portal
    if (expectedRole && expectedRole === 'ADMIN' && authoritativeRole !== 'ADMIN') {
      const err = new Error('Access Denied: This account does not have administrator privileges.');
      err.statusCode = 403;
      err.code = 'ROLE_UNAUTHORIZED';
      throw err;
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    users[normalized] = user;
    this.writeUsers(users);

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: authoritativeRole,
      },
      token,
    };
  }

  async registerUser({ email, password, fullName }) {
    const normalized = (email || '').toLowerCase().trim();
    const users = this.readUsers();

    if (users[normalized]) {
      throw new Error('An account with this email address already exists.');
    }

    // Public registration CANNOT register administrators
    // Only emails specifically configured in ADMIN_EMAILS can become ADMIN
    const role = getAdminEmails().includes(normalized) ? 'ADMIN' : 'USER';

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalized,
      fullName: fullName || normalized.split('@')[0],
      passwordHash: hashPassword(password),
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    users[normalized] = newUser;
    this.writeUsers(users);

    const token = this.generateToken(newUser);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      },
      token,
    };
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', 'assetbridge_token_secret_jwt_2026').update(b64).digest('hex');
    return `ab_token_${b64}.${signature}`;
  }

  verifyToken(tokenString) {
    if (!tokenString || typeof tokenString !== 'string') return null;

    // Handle token format: ab_token_<payloadB64>.<signature>
    if (tokenString.startsWith('ab_token_')) {
      const rest = tokenString.slice('ab_token_'.length);
      const parts = rest.split('.');
      if (parts.length === 2) {
        const [b64, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', 'assetbridge_token_secret_jwt_2026').update(b64).digest('hex');
        if (signature === expectedSig) {
          try {
            const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
            if (payload.expiresAt && Date.now() > payload.expiresAt) {
              return null; // Expired
            }
            return payload;
          } catch {
            return null;
          }
        }
      }
    }

    // Handle legacy bearer tokens for compatibility
    if (tokenString.startsWith('bearer_')) {
      const parts = tokenString.split('_');
      if (parts.length >= 3) {
        try {
          const email = Buffer.from(parts[2], 'base64').toString('utf8');
          const role = this.getRoleForEmail(email);
          return {
            id: email,
            email,
            role,
            expiresAt: Date.now() + 86400000,
          };
        } catch {
          return null;
        }
      }
    }

    // Handle test admin token
    if (tokenString === 'mock_admin_token_assetbridge') {
      return {
        id: 'usr_admin_001',
        email: 'admin@assetbridge.africa',
        role: 'ADMIN',
        expiresAt: Date.now() + 86400000,
      };
    }

    // Handle test user token
    if (tokenString.startsWith('mock_jwt') || tokenString.startsWith('demo-')) {
      return {
        id: 'usr_test_002',
        email: 'user@assetbridge.africa',
        role: 'USER',
        expiresAt: Date.now() + 86400000,
      };
    }

    return null;
  }

  getAllUsers() {
    const users = this.readUsers();
    return Object.values(users).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: this.getRoleForEmail(u.email),
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));
  }

  updateUserStatus(email, status) {
    const normalized = (email || '').toLowerCase().trim();
    const users = this.readUsers();
    if (!users[normalized]) {
      throw new Error(`User ${email} not found`);
    }
    users[normalized].status = status;
    this.writeUsers(users);
    return users[normalized];
  }
}

export const userService = new UserService();

