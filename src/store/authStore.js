import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import authService from '../services/authService';

// ─── State Shape ─────────────────────────────────────────────────────────────
const initialState = {
  user:          null,
  isAuthenticated: false,
  isLoading:     true,   // true while we check persisted session on boot
  isInitialized: false,
};

// ─── Action Types ─────────────────────────────────────────────────────────────
const AUTH_ACTIONS = {
  INITIALIZE:   'INITIALIZE',
  SIGN_IN:      'SIGN_IN',
  SIGN_OUT:     'SIGN_OUT',
  SET_LOADING:  'SET_LOADING',
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

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for an existing Cognito session when the app first mounts
  useEffect(() => {
    const initializeAuth = async () => {
      const { data: user } = await authService.getCurrentUser();
      dispatch({
        type: AUTH_ACTIONS.INITIALIZE,
        payload: { user },
      });
    };
    initializeAuth();
  }, []);

  const signIn = useCallback(async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    const { data, error } = await authService.signIn(email, password);
    if (error) {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      return { success: false, error };
    }
    // After successful sign-in, fetch the full user object
    const { data: user } = await authService.getCurrentUser();
    dispatch({ type: AUTH_ACTIONS.SIGN_IN, payload: { user } });
    return { success: true, error: null };
  }, []);

  const signOut = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    await authService.signOut();
    dispatch({ type: AUTH_ACTIONS.SIGN_OUT });
  }, []);

  const value = {
    ...state,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
