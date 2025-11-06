/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next/server$': '<rootDir>/tests/__mocks__/next-server.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@noble|@solana|jayson)/)',
  ],
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    '!src/lib/**/*.d.ts',
    '!src/lib/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Globals for Node.js environment
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};

