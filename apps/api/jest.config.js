/** Suite de integración: levanta la app real contra una base de test. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  // Corre antes de importar cualquier módulo: varias configs se leen del entorno
  // en tiempo de import (throttler, secretos).
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  testTimeout: 30_000,
  // En serie: comparten una sola base de datos.
  maxWorkers: 1,
  verbose: true,
};
