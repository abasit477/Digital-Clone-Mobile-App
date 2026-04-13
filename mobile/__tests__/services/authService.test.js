/**
 * Tests for authService.
 * Mocks are defined inline inside factories to avoid jest.mock hoisting TDZ issues.
 */

// All mocks must be set up before any imports
jest.mock('../../src/config/aws', () => ({
  userPool: {
    signUp:         jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

jest.mock('amazon-cognito-identity-js', () => ({
  CognitoUser:           jest.fn(),
  AuthenticationDetails: jest.fn(),
  CognitoUserAttribute:  jest.fn(({ Name, Value }) => ({ Name, Value })),
}));

jest.mock('../../src/utils/syncStorage', () => ({ syncStorage: {} }));

import { authService } from '../../src/services/authService';

// Lazy accessors — resolved after Jest sets up the mocks
const pool    = () => require('../../src/config/aws').userPool;
const Cognito = () => require('amazon-cognito-identity-js');

let mockUser;

beforeEach(() => {
  jest.clearAllMocks();

  mockUser = {
    confirmRegistration:    jest.fn(),
    authenticateUser:       jest.fn(),
    signOut:                jest.fn(),
    getSession:             jest.fn(),
    forgotPassword:         jest.fn(),
    confirmPassword:        jest.fn(),
    updateAttributes:       jest.fn(),
    resendConfirmationCode: jest.fn(),
  };

  Cognito().CognitoUser.mockImplementation(() => mockUser);
});

// ── signUp ────────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  it('resolves with user data on success', async () => {
    pool().signUp.mockImplementation((email, pass, attrs, _, cb) => {
      cb(null, { user: { getUsername: () => email } });
    });
    const { data, error } = await authService.signUp('user@test.com', 'Password1', 'John');
    expect(error).toBeNull();
    expect(data.user.getUsername()).toBe('user@test.com');
  });

  it('normalises email to lowercase before sending', async () => {
    pool().signUp.mockImplementation((email, pass, attrs, _, cb) => {
      cb(null, { user: { getUsername: () => email } });
    });
    await authService.signUp('USER@Test.COM', 'Password1', 'John');
    expect(pool().signUp).toHaveBeenCalledWith(
      'user@test.com', expect.anything(), expect.anything(), null, expect.any(Function),
    );
  });

  it('resolves with error on UsernameExistsException', async () => {
    const err = { name: 'UsernameExistsException', message: 'User already exists' };
    pool().signUp.mockImplementation((email, pass, attrs, _, cb) => cb(err, null));
    const { data, error } = await authService.signUp('existing@test.com', 'Password1', 'John');
    expect(data).toBeNull();
    expect(error.name).toBe('UsernameExistsException');
  });

  it('includes name attribute in signup attributes', async () => {
    pool().signUp.mockImplementation((email, pass, attrs, _, cb) => {
      cb(null, { user: { getUsername: () => email } });
    });
    await authService.signUp('user@test.com', 'Password1', 'Jane Doe');
    const attrs = pool().signUp.mock.calls[0][2];
    const nameAttr = attrs.find(a => a.Name === 'name');
    expect(nameAttr).toBeTruthy();
    expect(nameAttr.Value).toBe('Jane Doe');
  });
});

// ── confirmSignUp ─────────────────────────────────────────────────────────────

describe('authService.confirmSignUp', () => {
  it('resolves with SUCCESS on valid code', async () => {
    mockUser.confirmRegistration.mockImplementation((code, force, cb) => cb(null, 'SUCCESS'));
    const { data, error } = await authService.confirmSignUp('user@test.com', '123456');
    expect(error).toBeNull();
    expect(data).toBe('SUCCESS');
  });

  it('trims whitespace from code before confirming', async () => {
    mockUser.confirmRegistration.mockImplementation((code, force, cb) => cb(null, 'SUCCESS'));
    await authService.confirmSignUp('user@test.com', '  123456  ');
    expect(mockUser.confirmRegistration).toHaveBeenCalledWith('123456', true, expect.any(Function));
  });

  it('resolves with error on CodeMismatchException', async () => {
    const err = { name: 'CodeMismatchException', message: 'Invalid code provided' };
    mockUser.confirmRegistration.mockImplementation((code, force, cb) => cb(err, null));
    const { data, error } = await authService.confirmSignUp('user@test.com', '000000');
    expect(data).toBeNull();
    expect(error.name).toBe('CodeMismatchException');
  });
});

// ── signIn ────────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  it('resolves with session on successful authentication', async () => {
    const mockSession = { isValid: () => true };
    mockUser.authenticateUser.mockImplementation((details, cb) => cb.onSuccess(mockSession));
    const { data, error } = await authService.signIn('user@test.com', 'Password1');
    expect(error).toBeNull();
    expect(data).toBe(mockSession);
  });

  it('resolves with error on NotAuthorizedException', async () => {
    const err = { name: 'NotAuthorizedException', message: 'Incorrect username or password.' };
    mockUser.authenticateUser.mockImplementation((details, cb) => cb.onFailure(err));
    const { data, error } = await authService.signIn('user@test.com', 'WrongPass1');
    expect(data).toBeNull();
    expect(error.name).toBe('NotAuthorizedException');
  });

  it('resolves with NewPasswordRequired error for forced password change', async () => {
    mockUser.authenticateUser.mockImplementation((details, cb) => cb.newPasswordRequired({}));
    const { data, error } = await authService.signIn('user@test.com', 'OldPass1');
    expect(data).toBeNull();
    expect(error.name).toBe('NewPasswordRequired');
    expect(error.message).toContain('new password');
  });

  it('normalises email to lowercase when creating CognitoUser', async () => {
    const mockSession = { isValid: () => true };
    mockUser.authenticateUser.mockImplementation((details, cb) => cb.onSuccess(mockSession));
    await authService.signIn('USER@Test.COM', 'Password1');
    expect(Cognito().CognitoUser).toHaveBeenCalledWith(
      expect.objectContaining({ Username: 'user@test.com' }),
    );
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('authService.signOut', () => {
  it('calls signOut on current user and resolves with true', async () => {
    pool().getCurrentUser.mockReturnValue({ signOut: (cb) => cb() });
    const { data, error } = await authService.signOut();
    expect(data).toBe(true);
    expect(error).toBeNull();
  });

  it('resolves cleanly when no user is signed in', async () => {
    pool().getCurrentUser.mockReturnValue(null);
    const { data, error } = await authService.signOut();
    expect(data).toBe(true);
    expect(error).toBeNull();
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe('authService.getCurrentUser', () => {
  it('resolves with user when session is valid', async () => {
    const cognitoUser = { getSession: (cb) => cb(null, { isValid: () => true }) };
    pool().getCurrentUser.mockReturnValue(cognitoUser);
    const { data, error } = await authService.getCurrentUser();
    expect(data).toBe(cognitoUser);
    expect(error).toBeNull();
  });

  it('resolves with null when no current user in pool', async () => {
    pool().getCurrentUser.mockReturnValue(null);
    const { data } = await authService.getCurrentUser();
    expect(data).toBeNull();
  });

  it('resolves with null when session is invalid', async () => {
    pool().getCurrentUser.mockReturnValue({
      getSession: (cb) => cb(null, { isValid: () => false }),
    });
    const { data } = await authService.getCurrentUser();
    expect(data).toBeNull();
  });

  it('resolves with null on session error', async () => {
    pool().getCurrentUser.mockReturnValue({
      getSession: (cb) => cb(new Error('Session expired'), null),
    });
    const { data } = await authService.getCurrentUser();
    expect(data).toBeNull();
  });
});

// ── getSession ────────────────────────────────────────────────────────────────

describe('authService.getSession', () => {
  it('resolves with session when user exists', async () => {
    const mockSession = { isValid: () => true };
    pool().getCurrentUser.mockReturnValue({ getSession: (cb) => cb(null, mockSession) });
    const { data, error } = await authService.getSession();
    expect(data).toBe(mockSession);
    expect(error).toBeNull();
  });

  it('resolves with null when no current user', async () => {
    pool().getCurrentUser.mockReturnValue(null);
    const { data } = await authService.getSession();
    expect(data).toBeNull();
  });

  it('resolves with error when getSession fails', async () => {
    const err = new Error('Network error');
    pool().getCurrentUser.mockReturnValue({ getSession: (cb) => cb(err, null) });
    const { data, error } = await authService.getSession();
    expect(data).toBeNull();
    expect(error).toBe(err);
  });
});

// ── setUserRole ───────────────────────────────────────────────────────────────

describe('authService.setUserRole', () => {
  it('updates custom:role attribute successfully', async () => {
    pool().getCurrentUser.mockReturnValue({
      getSession: (cb) => cb(null, {}),
      updateAttributes: (attrs, cb) => cb(null, 'SUCCESS'),
    });
    const { data, error } = await authService.setUserRole('creator');
    expect(data).toBe('SUCCESS');
    expect(error).toBeNull();
  });

  it('resolves with error when no current user', async () => {
    pool().getCurrentUser.mockReturnValue(null);
    const { data, error } = await authService.setUserRole('creator');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error.message).toContain('No current user');
  });

  it('resolves with error when getSession fails', async () => {
    const sessionErr = new Error('Session expired');
    pool().getCurrentUser.mockReturnValue({
      getSession: (cb) => cb(sessionErr),
    });
    const { data, error } = await authService.setUserRole('creator');
    expect(data).toBeNull();
    expect(error).toBe(sessionErr);
  });
});

// ── forgotPassword ────────────────────────────────────────────────────────────

describe('authService.forgotPassword', () => {
  it('resolves with delivery details on success', async () => {
    mockUser.forgotPassword.mockImplementation((cb) => {
      cb.onSuccess({ CodeDeliveryDetails: { Destination: 'u***@test.com' } });
    });
    const { data, error } = await authService.forgotPassword('user@test.com');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it('resolves with error when user not found', async () => {
    const err = { name: 'UserNotFoundException', message: 'User does not exist.' };
    mockUser.forgotPassword.mockImplementation((cb) => cb.onFailure(err));
    const { data, error } = await authService.forgotPassword('ghost@test.com');
    expect(data).toBeNull();
    expect(error.name).toBe('UserNotFoundException');
  });
});

// ── resendCode ────────────────────────────────────────────────────────────────

describe('authService.resendCode', () => {
  it('resolves with result on success', async () => {
    mockUser.resendConfirmationCode.mockImplementation((cb) => cb(null, 'SUCCESS'));
    const { data, error } = await authService.resendCode('user@test.com');
    expect(data).toBe('SUCCESS');
    expect(error).toBeNull();
  });

  it('resolves with error on LimitExceededException', async () => {
    const err = { name: 'LimitExceededException', message: 'Attempt limit exceeded' };
    mockUser.resendConfirmationCode.mockImplementation((cb) => cb(err, null));
    const { data, error } = await authService.resendCode('user@test.com');
    expect(data).toBeNull();
    expect(error.name).toBe('LimitExceededException');
  });
});
