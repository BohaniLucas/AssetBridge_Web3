import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'assetbridge:offline:v1:';

const keyFor = (key) => `${CACHE_PREFIX}${key}`;

export const offlineStorage = {
  async get(key) {
    try {
      const value = await AsyncStorage.getItem(keyFor(key));
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async set(key, value) {
    try {
      if (value === undefined) return false;
      await AsyncStorage.setItem(keyFor(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(keyFor(key));
    } catch {
      // Cache cleanup should never block the main action.
    }
  },
};
