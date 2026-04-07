/**
 * Form validation utilities
 */

export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return 'Email address is required.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  return null;
};

export const validatePassword = (password) => {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
};

export const validateOtp = (otp) => {
  if (!otp || otp.trim() === '') {
    return 'Verification code is required.';
  }
  if (!/^\d{6}$/.test(otp.trim())) {
    return 'Please enter the 6-digit verification code.';
  }
  return null;
};

/**
 * Parse Cognito / Amplify error messages into user-friendly strings.
 */
export const parseCognitoError = (error) => {
  const message = error?.message || '';

  const errorMap = {
    'User already exists': 'An account with this email already exists. Please log in.',
    'Invalid verification code provided': 'The verification code is incorrect. Please try again.',
    'Invalid code provided': 'The verification code is incorrect. Please try again.',
    'Code expired': 'The verification code has expired. Please request a new one.',
    'Attempt limit exceeded': 'Too many attempts. Please wait a moment and try again.',
    'Incorrect username or password': 'Incorrect email or password. Please try again.',
    'User does not exist': 'No account found with this email address.',
    'User is not confirmed': 'Please verify your email address before logging in.',
    'Password did not conform with policy':
      'Password must be at least 8 characters with uppercase, lowercase, and a number.',
    'An account with the given email already exists':
      'An account with this email already exists. Please log in.',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) return value;
  }

  return message || 'Something went wrong. Please try again.';
};
