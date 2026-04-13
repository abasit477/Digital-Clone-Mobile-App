const sharedConfig = {
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '@react-native-async-storage/async-storage':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    // Mock expo's winter runtime to avoid Jest 30 module scoping errors
    'expo/src/winter/ImportMetaRegistry': '<rootDir>/jest.emptyMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};

module.exports = {
  // Use two projects:
  // 1. "unit" — services, utils, store: run in Node to avoid Expo native runtime issues
  // 2. "screens" — React Native screen components: run in jest-expo environment
  projects: [
    {
      ...sharedConfig,
      displayName: 'unit',
      preset: 'jest-expo',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/utils/**/*.test.{js,jsx}',
        '<rootDir>/__tests__/services/**/*.test.{js,jsx}',
        '<rootDir>/__tests__/store/**/*.test.{js,jsx}',
      ],
    },
    {
      ...sharedConfig,
      displayName: 'screens',
      preset: 'jest-expo',
      testMatch: [
        '<rootDir>/__tests__/screens/**/*.test.{js,jsx}',
      ],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/config/**',
  ],
};
