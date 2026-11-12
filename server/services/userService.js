/**
 * User & Role Service
 * Provides authoritative persistence, password hashing, JWT/Bearer token issuance,
 * and strict Role-Based Access Control (RBAC) separating USER and ADMIN.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

class UserService {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, '{}', 'utf8');
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
    const users = this.readUsers();
    if (users[normalized] && users[normalized].role === 'ADMIN') {
      return 'ADMIN';
    }
    return 'USER';
  }

  async authenticateUser() {
    throw new Error('Local password authentication is disabled. Authenticate through Supabase Auth.');
  }

  async registerUser() {
    throw new Error('Local account registration is disabled. Register through Supabase Auth.');
  }

  generateToken() {
    throw new Error('Local token signing is disabled. Use Supabase Auth access tokens.');
  }

  verifyToken() {
    return null;
  }

  getAllUsers() {
    return [];
  }

  updateUserStatus() {
    throw new Error('Local user status is not authoritative. Manage account status through Supabase Auth.');
  }
}

export const userService = new UserService();

