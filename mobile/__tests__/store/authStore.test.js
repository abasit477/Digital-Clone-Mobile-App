import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/store/authStore';
import authService from '../../src/services/authService';

jest.mock('../../src/services/authService');
jest.mock('../../src/config/adminConfig', () => ({ ADMIN_EMAIL: 'admin@test.com' }));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

// Helper: build a mock Cognito session with given token payload
function makeSession(payload) {
  return {
    getIdToken: () => ({ payload }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no user logged in
  authService.getCurrentUser.mockResolvedValue({ data: null, error: null });
});

// ── initialization ────────────────────────────────────────────────────────────

describe('AuthStore — initialization', () => {
  it('completes initialization as unauthenticated when no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('initializes authenticated when valid session exists', async () => {
    authService.getCurrentUser.mockResolvedValue({ data: { username: 'creator@test.com' }, error: null });
    authService.getSession.mockResolvedValue({
      data: makeSession({ email: 'creator@test.com', name: 'Test User', 'custom:role': 'creator' }),
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('creator@test.com');
    expect(result.current.user?.displayName).toBe('Test User');
    expect(result.current.user?.role).toBe('creator');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
  });
});

// ── signIn ────────────────────────────────────────────────────────────────────

describe('AuthStore — signIn', () => {
  it('sets user and isAuthenticated on success', async () => {
    authService.signIn.mockResolvedValue({
      data: makeSession({ email: 'user@test.com', name: 'Alice', 'custom:role': 'creator' }),
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let signInResult;
    await act(async () => {
      signInResult = await result.current.signIn('user@test.com', 'Password1');
    });

    expect(signInResult.success).toBe(true);
    expect(signInResult.error).toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('user@test.com');
    expect(result.current.user?.role).toBe('creator');
    expect(result.current.isLoading).toBe(false);
  });

  it('stays unauthenticated on wrong credentials', async () => {
    const err = { name: 'NotAuthorizedException', message: 'Incorrect username or password.' };
    authService.signIn.mockResolvedValue({ data: null, error: err });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let signInResult;
    await act(async () => {
      signInResult = await result.current.signIn('user@test.com', 'WrongPass');
    });

    expect(signInResult.success).toBe(false);
    expect(signInResult.error).toBe(err);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('AuthStore — signOut', () => {
  it('clears user and sets isAuthenticated to false', async () => {
    // First sign in
    authService.signIn.mockResolvedValue({
      data: makeSession({ email: 'user@test.com', 'custom:role': 'creator' }),
      error: null,
    });
    authService.signOut.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => { await result.current.signIn('user@test.com', 'Password1'); });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => { await result.current.signOut(); });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

// ── updateRole ────────────────────────────────────────────────────────────────

describe('AuthStore — updateRole', () => {
  it('updates role in state without re-authentication', async () => {
    authService.signIn.mockResolvedValue({
      data: makeSession({ email: 'user@test.com', name: 'Bob' }), // no custom:role
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await act(async () => { await result.current.signIn('user@test.com', 'Password1'); });

    expect(result.current.user?.role).toBeNull();

    await act(async () => { result.current.updateRole('creator'); });

    expect(result.current.user?.role).toBe('creator');
    expect(result.current.user?.username).toBe('user@test.com'); // preserved
  });
});

// ── deriveRole (role derivation logic) ───────────────────────────────────────

describe('AuthStore — role derivation', () => {
  async function signInWithPayload(payload) {
    authService.signIn.mockResolvedValue({ data: makeSession(payload), error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await act(async () => { await result.current.signIn('u@test.com', 'Password1'); });
    return result.current.user;
  }

  it('uses custom:role from ID token when present', async () => {
    const user = await signInWithPayload({ email: 'u@test.com', 'custom:role': 'member' });
    expect(user?.role).toBe('member');
  });

  it('uses custom:role "platform_admin" for admin users', async () => {
    const user = await signInWithPayload({ email: 'u@test.com', 'custom:role': 'platform_admin' });
    expect(user?.role).toBe('platform_admin');
  });

  it('falls back to ADMIN_EMAIL check when no custom:role', async () => {
    const user = await signInWithPayload({ email: 'admin@test.com' }); // matches mock ADMIN_EMAIL
    expect(user?.role).toBe('platform_admin');
  });

  it('returns null role for first-time users without custom:role', async () => {
    const user = await signInWithPayload({ email: 'newuser@test.com' });
    expect(user?.role).toBeNull();
  });

  it('reads displayName from "name" claim', async () => {
    const user = await signInWithPayload({ email: 'u@test.com', name: 'Alice Smith', 'custom:role': 'creator' });
    expect(user?.displayName).toBe('Alice Smith');
  });

  it('sets displayName to null when name claim is missing', async () => {
    const user = await signInWithPayload({ email: 'u@test.com', 'custom:role': 'creator' });
    expect(user?.displayName).toBeNull();
  });
});
