module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: false,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
};
