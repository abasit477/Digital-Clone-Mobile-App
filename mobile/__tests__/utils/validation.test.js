import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateOtp,
  parseCognitoError,
} from '../../src/utils/validation';

describe('validateEmail', () => {
  it('returns error for empty string', () => {
    expect(validateEmail('')).toBe('Email address is required.');
  });

  it('returns error for null', () => {
    expect(validateEmail(null)).toBe('Email address is required.');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateEmail('   ')).toBe('Email address is required.');
  });

  it('returns error for missing @', () => {
    expect(validateEmail('notanemail')).toBe('Please enter a valid email address.');
  });

  it('returns error for missing domain extension', () => {
    expect(validateEmail('user@domain')).toBe('Please enter a valid email address.');
  });

  it('returns null for valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('trims whitespace before validating', () => {
    expect(validateEmail('  user@example.com  ')).toBeNull();
  });

  it('returns null for email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.uk')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('returns error when empty string', () => {
    expect(validatePassword('')).toBeTruthy();
  });

  it('returns error when null', () => {
    expect(validatePassword(null)).toBeTruthy();
  });

  it('returns error when too short (7 chars)', () => {
    expect(validatePassword('Ab1defg')).toBe('Password must be at least 8 characters.');
  });

  it('returns error when no uppercase letter', () => {
    expect(validatePassword('abcdefg1')).toBe('Password must contain at least one uppercase letter.');
  });

  it('returns error when no lowercase letter', () => {
    expect(validatePassword('ABCDEFG1')).toBe('Password must contain at least one lowercase letter.');
  });

  it('returns error when no number', () => {
    expect(validatePassword('Abcdefgh')).toBe('Password must contain at least one number.');
  });

  it('returns null for valid password', () => {
    expect(validatePassword('SecurePass1')).toBeNull();
  });

  it('returns null for exactly 8 chars with all requirements', () => {
    expect(validatePassword('Secure1!')).toBeNull();
  });
});

describe('validateConfirmPassword', () => {
  it('returns error when confirm password is empty', () => {
    expect(validateConfirmPassword('SecurePass1', '')).toBeTruthy();
  });

  it('returns error when confirm password is null', () => {
    expect(validateConfirmPassword('SecurePass1', null)).toBeTruthy();
  });

  it('returns error when passwords do not match', () => {
    expect(validateConfirmPassword('SecurePass1', 'DifferentPass1')).toBe('Passwords do not match.');
  });

  it('returns null when passwords match', () => {
    expect(validateConfirmPassword('SecurePass1', 'SecurePass1')).toBeNull();
  });
});

describe('validateOtp', () => {
  it('returns error when empty', () => {
    expect(validateOtp('')).toBe('Verification code is required.');
  });

  it('returns error when null', () => {
    expect(validateOtp(null)).toBe('Verification code is required.');
  });

  it('returns error for 5-digit code', () => {
    expect(validateOtp('12345')).toBe('Please enter the 6-digit verification code.');
  });

  it('returns error for 7-digit code', () => {
    expect(validateOtp('1234567')).toBe('Please enter the 6-digit verification code.');
  });

  it('returns error for non-numeric 6-char string', () => {
    expect(validateOtp('abc123')).toBe('Please enter the 6-digit verification code.');
  });

  it('returns null for valid 6-digit code', () => {
    expect(validateOtp('123456')).toBeNull();
  });

  it('trims whitespace before validating', () => {
    expect(validateOtp(' 123456 ')).toBeNull();
  });
});

describe('parseCognitoError', () => {
  it('maps "User already exists" to friendly message', () => {
    expect(parseCognitoError({ message: 'User already exists' })).toContain('already exists');
  });

  it('maps "Incorrect username or password" to friendly message', () => {
    expect(parseCognitoError({ message: 'Incorrect username or password.' }))
      .toBe('Incorrect email or password. Please try again.');
  });

  it('maps "User is not confirmed" to friendly message', () => {
    expect(parseCognitoError({ message: 'User is not confirmed.' }))
      .toContain('verify your email');
  });

  it('maps "Invalid verification code" to friendly message', () => {
    expect(parseCognitoError({ message: 'Invalid verification code provided' }))
      .toContain('incorrect');
  });

  it('maps "Code expired" to friendly message', () => {
    expect(parseCognitoError({ message: 'Code expired' })).toContain('expired');
  });

  it('maps "Attempt limit exceeded" to friendly message', () => {
    expect(parseCognitoError({ message: 'Attempt limit exceeded' })).toContain('Too many');
  });

  it('returns raw message for unknown error', () => {
    expect(parseCognitoError({ message: 'Some network error' })).toBe('Some network error');
  });

  it('returns fallback for null error', () => {
    expect(parseCognitoError(null)).toBe('Something went wrong. Please try again.');
  });

  it('returns fallback for error with no message', () => {
    expect(parseCognitoError({ name: 'SomeError' })).toBe('Something went wrong. Please try again.');
  });
});
