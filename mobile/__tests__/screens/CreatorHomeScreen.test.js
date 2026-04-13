import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CreatorHomeScreen from '../../src/screens/CreatorHomeScreen';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }) => children,
}));

jest.mock('../../src/store/authStore', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../src/store/authStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockNavigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { displayName: 'John', role: 'creator' } });
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('CreatorHomeScreen — rendering', () => {
  it('shows personalised greeting with user display name', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/Hi, John/)).toBeTruthy();
  });

  it('shows generic greeting when user has no display name', () => {
    useAuth.mockReturnValue({ user: { role: 'creator' } });
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/Hi, there/)).toBeTruthy();
  });

  it('shows generic greeting when user is null', () => {
    useAuth.mockReturnValue({ user: null });
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/Hi, there/)).toBeTruthy();
  });

  it('renders the hero title', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText('Create Your AI Clone')).toBeTruthy();
  });

  it('renders the hero subtitle', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/Capture your personality/)).toBeTruthy();
  });

  it('renders all 4 feature bullets', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/Answer 20 questions/)).toBeTruthy();
    expect(getByText(/AI builds your personality/)).toBeTruthy();
    expect(getByText(/talks like you/)).toBeTruthy();
    expect(getByText(/Only the people you invite/)).toBeTruthy();
  });

  it('renders the CTA button', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText('Create My Clone')).toBeTruthy();
  });

  it('renders the time estimate hint', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText(/10–15 minutes/)).toBeTruthy();
  });

  it('renders the profile button', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    expect(getByText('👤')).toBeTruthy();
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('CreatorHomeScreen — navigation', () => {
  it('navigates to CloneTypeSelect when CTA button is pressed', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Create My Clone'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CloneTypeSelect');
  });

  it('navigates to Profile when profile icon is pressed', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('👤'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
  });

  it('only navigates once per CTA press', () => {
    const { getByText } = render(<CreatorHomeScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Create My Clone'));
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
  });
});
