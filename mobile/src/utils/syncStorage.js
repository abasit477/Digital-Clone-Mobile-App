import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SyncStorage
 *
 * amazon-cognito-identity-js calls storage.getItem() synchronously.
 * AsyncStorage is async-only, so passing it directly causes getItem()
 * to return a Promise object instead of the stored string value —
 * breaking all SRP auth parameter serialization.
 *
 * This wrapper keeps an in-memory mirror of all Cognito keys.
 * Reads are synchronous (from memory).
 * Writes are synchronous to memory + async to AsyncStorage for persistence.
 * Call hydrate() once on app boot to load persisted keys into memory.
 */
class SyncStorage {
  constructor() {
    this._store = {};
  }

  async hydrate() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cognitoKeys = allKeys.filter((k) =>
        k.startsWith('CognitoIdentityServiceProvider'),
      );
      if (cognitoKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(cognitoKeys);
        pairs.forEach(([key, value]) => {
          if (value !== null) this._store[key] = value;
        });
        console.log('[SyncStorage] hydrated', cognitoKeys.length, 'keys');
      } else {
        console.log('[SyncStorage] no persisted Cognito keys found');
      }
    } catch (e) {
      console.error('[SyncStorage] hydrate error:', e.message);
    }
  }

  // Synchronous — used by amazon-cognito-identity-js internally
  getItem(key) {
    const value = this._store[key] ?? null;
    return value;
  }

  setItem(key, value) {
    this._store[key] = String(value);
    AsyncStorage.setItem(key, String(value)).catch((e) =>
      console.error('[SyncStorage] setItem async error:', e.message),
    );
  }

  removeItem(key) {
    delete this._store[key];
    AsyncStorage.removeItem(key).catch((e) =>
      console.error('[SyncStorage] removeItem async error:', e.message),
    );
  }

  clear() {
    const keys = Object.keys(this._store);
    this._store = {};
    if (keys.length > 0) {
      AsyncStorage.multiRemove(keys).catch(() => {});
    }
  }
}

export const syncStorage = new SyncStorage();
