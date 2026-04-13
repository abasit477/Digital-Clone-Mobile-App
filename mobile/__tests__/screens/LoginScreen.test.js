import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import LoginScreen from '../../src/screens/LoginScreen';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../src/store/authStore', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../src/store/authStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSignIn = jest.fn();
const mockNavigation = { navigate: jest.fn() };

function renderScreen() {
  return render(<LoginScreen navigation={mockNavigation} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ signIn: mockSignIn });
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('LoginScreen — rendering', () => {
  it('shows the welcome heading', () => {
    const { getByText } = renderScreen();
    expect(getByText('Welcome back')).toBeTruthy();
  });

  it('shows the subheading', () => {
    const { getByText } = renderScreen();
    expect(getByText('Sign in to continue')).toBeTruthy();
  });

  it('renders email input field', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('renders password input field', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders Sign In button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('renders Forgot password link', () => {
    const { getByText } = renderScreen();
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('renders Create one sign-up link', () => {
    const { getByText } = renderScreen();
    expect(getByText('Create one')).toBeTruthy();
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('LoginScreen — validation', () => {
  it('shows email required error when submitting with empty email', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(getByText('Email address is required.')).toBeTruthy();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows invalid email error for bad email format', async () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'notanemail');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(getByText('Please enter a valid email address.')).toBeTruthy();
    });
  });

  it('shows password required error when email is valid but password is empty', async () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@test.com');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(getByText('Password is required.')).toBeTruthy();
    });
  });

  it('clears email error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = renderScreen();
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => expect(getByText('Email address is required.')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'u');
    await waitFor(() => {
      expect(queryByText('Email address is required.')).toBeNull();
    });
  });
});

// ── Submit ────────────────────────────────────────────────────────────────────

describe('LoginScreen — form submission', () => {
  it('calls signIn with email and password on valid submit', async () => {
    mockSignIn.mockResolvedValue({ success: true, error: null });
    const { getByText, getByPlaceholderText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'SecurePass1');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'SecurePass1');
  });

  it('shows API error message on failed login', async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: { message: 'Incorrect username or password.' },
    });
    const { getByText, getByPlaceholderText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'WrongPass1');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    await waitFor(() => {
      expect(getByText('Incorrect email or password. Please try again.')).toBeTruthy();
    });
  });

  it('navigates to Verification on UserNotConfirmedException', async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: { name: 'UserNotConfirmedException', message: 'User is not confirmed.' },
    });
    const { getByText, getByPlaceholderText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'unverified@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'SecurePass1');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Verification', {
      email: 'unverified@test.com',
    });
  });

  it('does not navigate on general auth error', async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: { message: 'Incorrect username or password.' },
    });
    const { getByText, getByPlaceholderText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'WrongPass1');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('LoginScreen — navigation links', () => {
  it('navigates to ForgotPassword when link is pressed', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Forgot password?'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('navigates to Signup when Create one is pressed', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Create one'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Signup');
  });
});
