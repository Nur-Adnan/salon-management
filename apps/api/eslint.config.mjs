import base from '@salon/config/eslint';

export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
