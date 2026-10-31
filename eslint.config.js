import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      'dev/payload-types.ts',
      'dev/next-env.d.ts',
      'dev/app/(payload)/**',
      'test/test-results/**',
      'test/playwright-report/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Classic hook rules only. The React Compiler rules in `recommended`
  // (refs, set-state-in-effect, …) reject the controller's latest-ref
  // pattern; adopting them is part of the controller refactor (TODO.md).
  {
    files: ['packages/plugin/src/**/*.tsx', 'packages/react/src/**/*.{ts,tsx}', 'dev/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  prettier,
)
