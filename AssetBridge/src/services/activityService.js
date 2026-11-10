const ACTIVITY_KEY = 'assetbridge_activity_v1';
const REMINDER_KEY = 'assetbridge_reminders_v1';
const CHANGE_EVENT = 'assetbridge-local-data-change';

const storageKey = (key, userId) => `${key}:${userId || 'demo'}`;

const readList = (key, userId) => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(key, userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const notifyChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export const activityService = {
  getActivities(userId) {
    return readList(ACTIVITY_KEY, userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  addActivity(activity, userId) {
    const item = { id: `activity-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, createdAt: new Date().toISOString(), ...activity };
    const key = storageKey(ACTIVITY_KEY, userId);
    localStorage.setItem(key, JSON.stringify([item, ...readList(ACTIVITY_KEY, userId)].slice(0, 100)));
    notifyChange();
    return item;
  },
  getReminders(userId) {
    return readList(REMINDER_KEY, userId).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  },
  addReminder(reminder, userId) {
    const item = { id: `reminder-${Date.now()}`, createdAt: new Date().toISOString(), completed: false, ...reminder };
    const key = storageKey(REMINDER_KEY, userId);
    localStorage.setItem(key, JSON.stringify([item, ...readList(REMINDER_KEY, userId)]));
    notifyChange();
    return item;
  },
  completeReminder(id, userId) {
    const items = readList(REMINDER_KEY, userId).map((item) => item.id === id ? { ...item, completed: true } : item);
    localStorage.setItem(storageKey(REMINDER_KEY, userId), JSON.stringify(items));
    notifyChange();
  },
};

export const activityChangeEvent = CHANGE_EVENT;
