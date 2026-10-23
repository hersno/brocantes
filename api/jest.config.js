module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.service.ts', '**/*.rules.ts', 'auth/auth.ts'],
  coverageDirectory: '../coverage',
  coverageThreshold: { global: { lines: 80, branches: 70, functions: 80 } },
};
