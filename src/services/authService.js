import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  resendSignUpCode,
  fetchAuthSession,
} from 'aws-amplify/auth';

/**
 * Auth Service — wraps AWS Amplify v6 Auth methods
 * All methods return { data, error } objects for consistent error handling.
 */

export const authService = {
  /**
   * Register a new user with email and password.
   * @param {string} email
   * @param {string} password
   */
  signUp: async (email, password) => {
    try {
      const result = await signUp({
        username: email.trim().toLowerCase(),
        password,
        options: {
          userAttributes: {
            email: email.trim().toLowerCase(),
          },
          autoSignIn: false,
        },
      });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Confirm sign-up using the OTP sent to the user's email.
   * @param {string} email
   * @param {string} code
   */
  confirmSignUp: async (email, code) => {
    try {
      const result = await confirmSignUp({
        username: email.trim().toLowerCase(),
        confirmationCode: code.trim(),
      });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Sign in with email and password.
   * @param {string} email
   * @param {string} password
   */
  signIn: async (email, password) => {
    try {
      const result = await signIn({
        username: email.trim().toLowerCase(),
        password,
      });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Sign out the current user.
   */
  signOut: async () => {
    try {
      await signOut();
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Get the current authenticated user.
   * Returns null if no user is authenticated.
   */
  getCurrentUser: async () => {
    try {
      const user = await getCurrentUser();
      return { data: user, error: null };
    } catch (error) {
      // Not authenticated — not an error state
      return { data: null, error: null };
    }
  },

  /**
   * Fetch the current auth session (tokens).
   * Useful for getting JWT tokens to attach to API requests.
   */
  getSession: async () => {
    try {
      const session = await fetchAuthSession();
      return { data: session, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Resend the verification code to the user's email.
   * @param {string} email
   */
  resendCode: async (email) => {
    try {
      const result = await resendSignUpCode({
        username: email.trim().toLowerCase(),
      });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

export default authService;
