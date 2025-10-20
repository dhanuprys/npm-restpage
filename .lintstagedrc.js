module.exports = {
  'src/**/*.js': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
    'git add',
  ],
};
