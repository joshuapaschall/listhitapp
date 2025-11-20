/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Treat TS as ESM so imports work with pure ESM deps
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.jest.json',
        isolatedModules: false
      }
    ],
  },

  // Let noble packages be transformed / loaded in ESM form
  transformIgnorePatterns: [
    'node_modules/(?!(@noble/ed25519|@noble/curves|@noble/hashes|nanoid)/)'
  ],

  // Fix relative ESM imports that end with .js in TS and map @/ to root
  moduleNameMapper: {
    "^.+\\.(css|less|sass|scss)$": "<rootDir>/tests/__mocks__/styleMock.js",
    "@supabase/auth-helpers-nextjs": "<rootDir>/tests/__mocks__/supabaseAuthHelpers.ts",
    "@/lib/supabase/admin": "<rootDir>/tests/__mocks__/supabaseAdmin.ts",
    "@/lib/telnyx/credentials": "<rootDir>/tests/__mocks__/telnyxCredentials.ts",
    "@/lib/supabase": "<rootDir>/tests/__mocks__/supabase.ts",
    "@/lib/supabase-browser\\.js$": "<rootDir>/tests/__mocks__/supabase-browser.ts",
    "@/lib/supabase-browser": "<rootDir>/tests/__mocks__/supabase-browser.ts",
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },

  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],

  // Helps Jest pick the ESM exports when available
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  }
};
