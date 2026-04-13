import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import authService from '../services/authService';
import { ADMIN_EMAIL } from '../config/adminConfig';

/**
 * Derive role from token payload.
 * Cognito custom attributes land as "custom:role" in the ID token.
 * Falls back to legacy ADMIN_EMAIL check so existing admin accounts still work.
 */
function deriveRole(payload, emailFallback) {
  const cognitoRole = payload['custom:role'];
  if (cognitoRole) return cognitoRole;
  // Legacy: hardcoded admin email
  const email = payload.email ?? emailFallback ?? '';
  if (email === ADMIN_EMAIL) return 'platform_admin';
  return null; // first-time user → RoleSelectScreen
}

// ─── State Shape ─────────────────────────────────────────────────────────────
const initialState = {
  user:            null,
  isAuthenticated: false,
  isLoading:       true,
  isInitialized:   false,
};

// ─── Action Types ─────────────────────────────────────────────────────────────
const AUTH_ACTIONS = {
  INITIALIZE:  'INITIALIZE',
  SIGN_IN:     'SIGN_IN',
  SIGN_OUT:    'SIGN_OUT',
  SET_LOADING: 'SET_LOADING',
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.INITIALIZE:
      return {
        ...state,
        user:            action.payload.user,
        isAuthenticated: !!action.payload.user,
        isLoading:       false,
        isInitialized:   true,
      };
    case AUTH_ACTIONS.SIGN_IN:
      return {
        ...state,
        user:            action.payload.user,
        isAuthenticated: true,
        isLoading:       false,
      };
    case AUTH_ACTIONS.SIGN_OUT:
      return {
        ...state,
        user:            null,
        isAuthenticated: false,
        isLoading:       false,
      };
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

/**
 * Removes any stale keys left by Amplify v6 or previous sessions.
 * amazon-cognito-identity-js throws a parse error if it encounters
 * Amplify's token format, so we purge those keys on first boot.
 */

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: cognitoUser } = await authService.getCurrentUser();
      if (!cognitoUser) {
        dispatch({ type: AUTH_ACTIONS.INITIALIZE, payload: { user: null } });
        return;
      }
      const { data: session } = await authService.getSession();
      const payload  = session?.getIdToken?.()?.payload ?? {};
      const email    = payload.email ?? cognitoUser.username;
      const user = {
        username:    email,
        displayName: payload.name ?? null,
        role:        deriveRole(payload, email),
      };
      dispatch({ type: AUTH_ACTIONS.INITIALIZE, payload: { user } });
    };
    initializeAuth();
  }, []);

  const signIn = useCallback(async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    const { data: session, error } = await authService.signIn(email, password);
    console.log('[AuthStore.signIn] session:', !!session, '| error:', error?.message);
    if (error) {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      return { success: false, error };
    }
    const payload = session?.getIdToken?.()?.payload ?? {};
    const username = payload.email ?? email.trim().toLowerCase();
    const user = {
      username:    username,
      displayName: payload.name ?? null,
      role:        deriveRole(payload, username),
    };
    console.log('[AuthStore.signIn] dispatching SIGN_IN → user:', user.username, '| role:', user.role);
    dispatch({ type: AUTH_ACTIONS.SIGN_IN, payload: { user } });
    return { success: true, error: null };
  }, []);

  const signOut = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    await authService.signOut();
    dispatch({ type: AUTH_ACTIONS.SIGN_OUT });
  }, []);

  // Called after setUserRole so navigation updates immediately
  const updateRole = useCallback((role) => {
    dispatch({
      type: AUTH_ACTIONS.SIGN_IN,
      payload: { user: { ...state.user, role } },
    });
  }, [state.user]);

  const value = { ...state, signIn, signOut, updateRole };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
