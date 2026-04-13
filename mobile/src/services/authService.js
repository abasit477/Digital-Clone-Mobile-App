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
    if (__DEV__) console.log('[authService.signUp] start →', email);
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
            if (__DEV__) console.log('[authService.signUp] success →', result?.user?.getUsername());
            resolve({ data: result, error: null });
          }
        },
      );
    });
  },

  confirmSignUp: async (email, code) => {
    if (__DEV__) console.log('[authService.confirmSignUp] start →', email);
    return new Promise((resolve) => {
      makeUser(email).confirmRegistration(code.trim(), true, (err, result) => {
        if (err) {
          console.error('[authService.confirmSignUp] error →', err.name, err.message);
          resolve({ data: null, error: err });
        } else {
          if (__DEV__) console.log('[authService.confirmSignUp] success');
          resolve({ data: result, error: null });
        }
      });
    });
  },

  signIn: async (email, password) => {
    if (__DEV__) console.log('[authService.signIn] start →', email);
    return new Promise((resolve) => {
      const authDetails = new AuthenticationDetails({
        Username: email.trim().toLowerCase(),
        Password: password,
      });
      const user = makeUser(email);
      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          if (__DEV__) console.log('[authService.signIn] success → isValid:', session.isValid());
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
          if (__DEV__) console.warn('[authService.signIn] newPasswordRequired');
          resolve({
            data: null,
            error: { message: 'A new password is required for this account.', name: 'NewPasswordRequired' },
          });
        },
      });
    });
  },

  signOut: async () => {
    if (__DEV__) console.log('[authService.signOut] start');
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (user) {
        user.signOut(() => {
          if (__DEV__) console.log('[authService.signOut] done');
          resolve({ data: true, error: null });
        });
      } else {
        resolve({ data: true, error: null });
      }
    });
  },

  getCurrentUser: async () => {
    if (__DEV__) console.log('[authService.getCurrentUser] start');
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        if (__DEV__) console.warn('[authService.getCurrentUser] TIMEOUT — resolving null');
        done({ data: null, error: null });
      }, 5000);

      try {
        const user = userPool.getCurrentUser();
        if (!user) {
          clearTimeout(timer);
          return done({ data: null, error: null });
        }

        user.getSession((err, session) => {
          clearTimeout(timer);
          if (err) {
            console.error('[authService.getCurrentUser] getSession error →', err.name, err.message);
            done({ data: null, error: null });
          } else if (!session || !session.isValid()) {
            if (__DEV__) console.warn('[authService.getCurrentUser] session invalid or null');
            done({ data: null, error: null });
          } else {
            if (__DEV__) console.log('[authService.getCurrentUser] valid session ✓');
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
    if (__DEV__) console.log('[authService.forgotPassword] start →', email);
    return new Promise((resolve) => {
      makeUser(email).forgotPassword({
        onSuccess: (data) => {
          if (__DEV__) console.log('[authService.forgotPassword] success');
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
    if (__DEV__) console.log('[authService.confirmForgotPassword] start →', email);
    return new Promise((resolve) => {
      makeUser(email).confirmPassword(code.trim(), newPassword, {
        onSuccess: () => {
          if (__DEV__) console.log('[authService.confirmForgotPassword] success');
          resolve({ data: true, error: null });
        },
        onFailure: (err) => {
          console.error('[authService.confirmForgotPassword] error →', err.name, err.message);
          resolve({ data: null, error: err });
        },
      });
    });
  },

  setUserRole: async (role) => {
    if (__DEV__) console.log('[authService.setUserRole] start →', role);
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (!user) return resolve({ data: null, error: new Error('No current user') });

      user.getSession((sessionErr) => {
        if (sessionErr) return resolve({ data: null, error: sessionErr });

        const attribute = new CognitoUserAttribute({
          Name:  'custom:role',
          Value: role,
        });
        user.updateAttributes([attribute], (err, result) => {
          if (err) {
            console.error('[authService.setUserRole] error →', err.name, err.message);
            resolve({ data: null, error: err });
          } else {
            if (__DEV__) console.log('[authService.setUserRole] success');
            resolve({ data: result, error: null });
          }
        });
      });
    });
  },

  resendCode: async (email) => {
    if (__DEV__) console.log('[authService.resendCode] start →', email);
    return new Promise((resolve) => {
      makeUser(email).resendConfirmationCode((err, result) => {
        if (err) {
          console.error('[authService.resendCode] error →', err.name, err.message);
          resolve({ data: null, error: err });
        } else {
          if (__DEV__) console.log('[authService.resendCode] success');
          resolve({ data: result, error: null });
        }
      });
    });
  },
};

export default authService;
