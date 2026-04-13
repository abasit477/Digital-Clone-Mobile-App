import AsyncStorage from '@react-native-async-storage/async-storage';

// Import after AsyncStorage is mocked via moduleNameMapper
import { syncStorage } from '../../src/utils/syncStorage';

beforeEach(() => {
  // Reset the internal in-memory store before each test
  syncStorage._store = {};
  AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('SyncStorage.getItem', () => {
  it('returns null for unknown key', () => {
    expect(syncStorage.getItem('nonexistent')).toBeNull();
  });

  it('returns stored value synchronously', () => {
    syncStorage._store['testKey'] = 'testValue';
    expect(syncStorage.getItem('testKey')).toBe('testValue');
  });

  it('returns null after key is removed', () => {
    syncStorage._store['key'] = 'value';
    delete syncStorage._store['key'];
    expect(syncStorage.getItem('key')).toBeNull();
  });
});

describe('SyncStorage.setItem', () => {
  it('stores value in memory synchronously', () => {
    syncStorage.setItem('myKey', 'myValue');
    expect(syncStorage._store['myKey']).toBe('myValue');
  });

  it('coerces non-string value to string', () => {
    syncStorage.setItem('numKey', 42);
    expect(syncStorage._store['numKey']).toBe('42');
  });

  it('overwrites existing value', () => {
    syncStorage.setItem('key', 'old');
    syncStorage.setItem('key', 'new');
    expect(syncStorage._store['key']).toBe('new');
  });

  it('calls AsyncStorage.setItem asynchronously', async () => {
    syncStorage.setItem('asyncKey', 'asyncValue');
    // Flush micro-task queue
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('asyncKey', 'asyncValue');
  });
});

describe('SyncStorage.removeItem', () => {
  it('removes key from in-memory store', () => {
    syncStorage._store['toRemove'] = 'value';
    syncStorage.removeItem('toRemove');
    expect(syncStorage._store['toRemove']).toBeUndefined();
  });

  it('does not throw when removing non-existent key', () => {
    expect(() => syncStorage.removeItem('ghost')).not.toThrow();
  });

  it('calls AsyncStorage.removeItem asynchronously', async () => {
    syncStorage._store['asyncKey'] = 'value';
    syncStorage.removeItem('asyncKey');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('asyncKey');
  });
});

describe('SyncStorage.clear', () => {
  it('empties the in-memory store', () => {
    syncStorage._store = { a: '1', b: '2', c: '3' };
    syncStorage.clear();
    expect(Object.keys(syncStorage._store)).toHaveLength(0);
  });

  it('does not throw on empty store', () => {
    syncStorage._store = {};
    expect(() => syncStorage.clear()).not.toThrow();
  });
});

describe('SyncStorage.hydrate', () => {
  it('loads Cognito keys from AsyncStorage into memory', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue([
      'CognitoIdentityServiceProvider.abc123.user.idToken',
      'CognitoIdentityServiceProvider.abc123.user.accessToken',
      'unrelatedKey',
    ]);
    AsyncStorage.multiGet.mockResolvedValue([
      ['CognitoIdentityServiceProvider.abc123.user.idToken', 'id-token-value'],
      ['CognitoIdentityServiceProvider.abc123.user.accessToken', 'access-token-value'],
    ]);

    await syncStorage.hydrate();

    expect(syncStorage._store['CognitoIdentityServiceProvider.abc123.user.idToken']).toBe('id-token-value');
    expect(syncStorage._store['CognitoIdentityServiceProvider.abc123.user.accessToken']).toBe('access-token-value');
    // Non-Cognito key should not be hydrated
    expect(syncStorage._store['unrelatedKey']).toBeUndefined();
  });

  it('handles no persisted Cognito keys gracefully', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue(['someOtherKey', 'anotherKey']);
    await syncStorage.hydrate();
    expect(Object.keys(syncStorage._store)).toHaveLength(0);
  });

  it('skips null values from AsyncStorage', async () => {
    AsyncStorage.getAllKeys.mockResolvedValue([
      'CognitoIdentityServiceProvider.abc123.user.refreshToken',
    ]);
    AsyncStorage.multiGet.mockResolvedValue([
      ['CognitoIdentityServiceProvider.abc123.user.refreshToken', null],
    ]);

    await syncStorage.hydrate();
    expect(syncStorage._store['CognitoIdentityServiceProvider.abc123.user.refreshToken']).toBeUndefined();
  });

  it('handles AsyncStorage errors gracefully', async () => {
    AsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage unavailable'));
    await expect(syncStorage.hydrate()).resolves.toBeUndefined();
    expect(Object.keys(syncStorage._store)).toHaveLength(0);
  });
});
