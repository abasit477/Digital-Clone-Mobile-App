import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { userPool } from '../config/aws';
import { syncStorage } from '../utils/syncStorage';

const makeUser = (email) =>
  new CognitoUser({
    Username: email.trim().toLowerCase(),
    Pool:     userPool,
    Storage:  syncStorage,
  });

export const authService = {
  signUp: async (email, password, name) => {
    console.log('[authService.signUp] start →', email);
    return new Promise((resolve) => {
      const attributes = [
        new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() }),
        new CognitoUserAttribute({ Name: 'name',  Value: (name ?? '').trim() }),
      ];
      userPool.signUp(
        email.trim().toLowerCase(),
        password,
        attributes,
        null,
        (err, result) => {
          if (err) {
            console.error('[authService.signUp] error →', err.name, err.message);
            resolve({ data: null, error: err });
          } else {
            console.log('[authService.signUp] success →', result?.user?.getUsername());
            resolve({ data: result, error: null });
          }
        },
      );
    });
  },

  confirmSignUp: async (email, code) => {
    console.log('[authService.confirmSignUp] start →', email, code);
    return new Promise((resolve) => {
      makeUser(email).confirmRegistration(code.trim(), true, (err, result) => {
        if (err) {
          console.error('[authService.confirmSignUp] error →', err.name, err.message);
          resolve({ data: null, error: err });
        } else {
          console.log('[authService.confirmSignUp] success →', result);
          resolve({ data: result, error: null });
        }
      });
    });
  },

  signIn: async (email, password) => {
    console.log('[authService.signIn] start →', email);
    return new Promise((resolve) => {
      const authDetails = new AuthenticationDetails({
        Username: email.trim().toLowerCase(),
        Password: password,
      });
      const user = makeUser(email);
      console.log('[authService.signIn] calling authenticateUser...');
      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          console.log('[authService.signIn] onSuccess → isValid:', session.isValid());
          console.log('[authService.signIn] idToken email:',
            session.getIdToken?.()?.payload?.email);
          resolve({ data: session, error: null });
        },
        onFailure: (err) => {
          console.error('[authService.signIn] onFailure →', {
            name:    err?.name,
            message: err?.message,
            code:    err?.code,
          });
          resolve({ data: null, error: err });
        },
        newPasswordRequired: (userAttributes) => {
          console.warn('[authService.signIn] newPasswordRequired →', userAttributes);
          resolve({
            data: null,
            error: { message: 'A new password is required for this account.', name: 'NewPasswordRequired' },
          });
        },
      });
    });
  },

  signOut: async () => {
    console.log('[authService.signOut] start');
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (user) {
        user.signOut(() => {
          console.log('[authService.signOut] done');
          resolve({ data: true, error: null });
        });
      } else {
        console.log('[authService.signOut] no current user');
        resolve({ data: true, error: null });
      }
    });
  },

  getCurrentUser: async () => {
    console.log('[authService.getCurrentUser] start');
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        console.log('[authService.getCurrentUser] resolving →',
          result.data ? `user: ${result.data.username}` : 'null');
        resolve(result);
      };

      const timer = setTimeout(() => {
        console.warn('[authService.getCurrentUser] TIMEOUT — resolving null');
        done({ data: null, error: null });
      }, 5000);

      try {
        const user = userPool.getCurrentUser();
        console.log('[authService.getCurrentUser] pool user →',
          user ? user.username : 'null');

        if (!user) {
          clearTimeout(timer);
          return done({ data: null, error: null });
        }

        user.getSession((err, session) => {
          clearTimeout(timer);
          if (err) {
            console.error('[authService.getCurrentUser] getSession error →',
              err.name, err.message);
            done({ data: null, error: null });
          } else if (!session || !session.isValid()) {
            console.warn('[authService.getCurrentUser] session invalid or null');
            done({ data: null, error: null });
          } else {
            console.log('[authService.getCurrentUser] valid session ✓');
            done({ data: user, error: null });
          }
        });
      } catch (e) {
        clearTimeout(timer);
        console.error('[authService.getCurrentUser] caught exception →', e.message);
        done({ data: null, error: null });
      }
    });
  },

  getSession: async () => {
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (!user) return resolve({ data: null, error: null });
      user.getSession((err, session) => {
        if (err) resolve({ data: null, error: err });
        else     resolve({ data: session, error: null });
      });
    });
  },

  forgotPassword: async (email) => {
    console.log('[authService.forgotPassword] start →', email);
    return new Promise((resolve) => {
      makeUser(email).forgotPassword({
        onSuccess: (data) => {
          console.log('[authService.forgotPassword] success');
          resolve({ data, error: null });
        },
        onFailure: (err) => {
          console.error('[authService.forgotPassword] error →', err.name, err.message);
          resolve({ data: null, error: err });
        },
      });
    });
  },

  confirmForgotPassword: async (email, code, newPassword) => {
    console.log('[authService.confirmForgotPassword] start →', email);
    return new Promise((resolve) => {
      makeUser(email).confirmPassword(code.trim(), newPassword, {
        onSuccess: () => {
          console.log('[authService.confirmForgotPassword] success');
          resolve({ data: true, error: null });
        },
        onFailure: (err) => {
          console.error('[authService.confirmForgotPassword] error →', err.name, err.message);
          resolve({ data: null, error: err });
        },
      });
    });
  },

  resendCode: async (email) => {
    console.log('[authService.resendCode] start →', email);
    return new Promise((resolve) => {
      makeUser(email).resendConfirmationCode((err, result) => {
        if (err) {
          console.error('[authService.resendCode] error →', err.name, err.message);
          resolve({ data: null, error: err });
        } else {
          console.log('[authService.resendCode] success');
          resolve({ data: result, error: null });
        }
      });
    });
  },
};

export default authService;
