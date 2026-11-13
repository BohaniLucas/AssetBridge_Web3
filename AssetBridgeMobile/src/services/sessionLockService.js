import * as SecureStore from 'expo-secure-store';

export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LAST_ACTIVE_KEY = 'assetbridge_last_active_time';
const IDLE_TIMEOUT_KEY = 'assetbridge_idle_timeout_ms';
const LOCK_STATE_KEY = 'assetbridge_session_is_locked';

class SessionLockService {
  constructor() {
    this.memoryLastActive = Date.now();
    this.memoryTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
    this.memoryIsLocked = false;
    this.lockListeners = new Set();
  }

  subscribe(listener) {
    this.lockListeners.add(listener);
    return () => this.lockListeners.delete(listener);
  }

  notifyListeners(locked) {
    this.memoryIsLocked = locked;
    for (const listener of this.lockListeners) {
      try {
        listener(locked);
      } catch {
        // Safe notification
      }
    }
  }

  async init() {
    if (await SecureStore.isAvailableAsync()) {
      try {
        const savedTimeout = await SecureStore.getItemAsync(IDLE_TIMEOUT_KEY);
        if (savedTimeout) {
          const parsed = parseInt(savedTimeout, 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            this.memoryTimeoutMs = parsed;
          }
        }
        const savedLast = await SecureStore.getItemAsync(LAST_ACTIVE_KEY);
        if (savedLast) {
          const parsedLast = parseInt(savedLast, 10);
          if (Number.isFinite(parsedLast) && parsedLast > 0) {
            this.memoryLastActive = parsedLast;
          }
        }
        const savedLock = await SecureStore.getItemAsync(LOCK_STATE_KEY);
        if (savedLock === 'true') {
          this.memoryIsLocked = true;
        }
      } catch {
        // Fallback to memory defaults
      }
    }
  }

  /**
   * Records user interaction timestamp.
   * Updates in-memory fast timestamp and persists asynchronously.
   */
  recordActivity() {
    const now = Date.now();
    this.memoryLastActive = now;
    SecureStore.isAvailableAsync().then((avail) => {
      if (avail) {
        SecureStore.setItemAsync(LAST_ACTIVE_KEY, String(now)).catch(() => {});
      }
    });
  }

  getLastActiveTime() {
    return this.memoryLastActive;
  }

  getIdleTimeoutMs() {
    return this.memoryTimeoutMs;
  }

  async setIdleTimeoutMs(ms) {
    const timeout = Math.max(60 * 1000, Number(ms) || DEFAULT_IDLE_TIMEOUT_MS);
    this.memoryTimeoutMs = timeout;
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(IDLE_TIMEOUT_KEY, String(timeout)).catch(() => {});
    }
  }

  /**
   * Checks wall-clock elapsed time against configured policy.
   * Accurately determines if session expired while app was suspended/sleeping.
   */
  hasIdleExpired(now = Date.now()) {
    return now - this.memoryLastActive >= this.memoryTimeoutMs;
  }

  /**
   * Authoritatively locks the protected financial UI.
   */
  async lock() {
    this.notifyListeners(true);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(LOCK_STATE_KEY, 'true').catch(() => {});
    }
  }

  /**
   * Unlocks the protected UI after verified reauthentication.
   */
  async unlock() {
    this.recordActivity();
    this.notifyListeners(false);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(LOCK_STATE_KEY, 'false').catch(() => {});
    }
  }

  /**
   * Handles app state transitions between foreground and background.
   * Solves OS sleep suspension by comparing wall-clock Date.now() on resume.
   */
  handleAppStateChange(nextAppState, previousAppState) {
    const now = Date.now();
    if (previousAppState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
      // Backgrounding: record final active timestamp before OS suspends
      this.recordActivity();
    } else if ((previousAppState === 'background' || previousAppState === 'inactive') && nextAppState === 'active') {
      // Resuming from background: evaluate actual wall-clock elapsed time
      if (this.hasIdleExpired(now)) {
        this.lock();
      }
    }
  }

  async clear() {
    this.memoryIsLocked = false;
    this.memoryLastActive = Date.now();
    if (await SecureStore.isAvailableAsync()) {
      await Promise.all([
        SecureStore.deleteItemAsync(LOCK_STATE_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(LAST_ACTIVE_KEY).catch(() => {}),
      ]);
    }
  }
}

export const sessionLockService = new SessionLockService();
export default sessionLockService;

