'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');

function runTest(prompts) {
  return helpers
    .run(path.join(__dirname, '../generators/app'))
    .withPrompts(prompts);
}

function writePackage(dir, extraPackageJson) {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      Object.assign(
        {
          name: 'test',
          version: '1.0.0',
          description: 'A test',
          main: 'index.js',
          author: 'John Doe',
          license: 'ISC'
        },
        extraPackageJson
      ),
      null,
      2
    )
  );
}

describe('@redwerks/generator-common-config:app', () => {
  describe('basic npm', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'npm',
        requireNpmClient: true,
        features: [],
        redwerksAuthor: true
      }).inTmpDir(dir => {
        writePackage(dir);
      })
    );

    it('sets redwerks as author', () => {
      assert.jsonFileContent('package.json', {
        author: 'Redwerks (https://redwerks.org/)',
        contributors: ['John Doe']
      });
    });

    it('sets npm engine requirement', () => {
      assert.jsonFileContent('package.json', {
        engines: { yarn: 'use npm' }
      });
    });

    it('configures husky', () => {
      assert.jsonFileContent('package.json', {
        husky: {
          hooks: {
            'pre-commit': 'lint-staged && license-validator'
          }
        }
      });
    });

    it('configures lint-staged', () => {
      assert.jsonFileContent('package.json', {
        'lint-staged': {
          '*.{js}': ['eslint --cache --ext .js']
        }
      });
    });

    it('creates .vscode/settings.json', () => {
      assert.file(['.vscode/settings.json']);
    });

    it('creates .prettierrc and .prettierignore', () => {
      assert.file(['.prettierrc', '.prettierignore']);

      assert.jsonFileContent('.prettierrc', {
        singleQuote: true,
        trailingComma: 'all'
      });
    });
  });

  describe('yarn', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'yarn',
        requireNpmClient: true,
        features: []
      }).inTmpDir(dir => {
        writePackage(dir);
      })
    );

    it('sets yarn engine requirement', () => {
      assert.jsonFileContent('package.json', {
        engines: { npm: 'use yarn' }
      });
    });
  });

  describe('yarn workspaces', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'yarn',
        requireNpmClient: true,
        features: []
      }).inTmpDir(dir => {
        writePackage(dir, {
          workspaces: ['packages/*']
        });
      })
    );

    it('sets yarn engine requirement', () => {
      assert.jsonFileContent('package.json', {
        engines: { npm: 'use yarn' }
      });
    });

    it('configures husky for workspaces', () => {
      assert.jsonFileContent('package.json', {
        husky: {
          hooks: {
            'pre-commit': 'lint-staged && yarn workspaces run license-validator'
          }
        }
      });
    });
  });

  describe('jsx', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'npm',
        requireNpmClient: false,
        features: ['jsx']
      }).inTmpDir(dir => {
        writePackage(dir);
      })
    );

    it('configures lint-staged', () => {
      assert.jsonFileContent('package.json', {
        'lint-staged': {
          '*.{js,jsx}': ['eslint --cache --ext .js,.jsx']
        }
      });
    });
  });

  describe('typescript', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'npm',
        requireNpmClient: false,
        features: ['ts']
      }).inTmpDir(dir => {
        writePackage(dir);
      })
    );

    it('configures lint-staged', () => {
      assert.jsonFileContent('package.json', {
        'lint-staged': {
          '*.{js,ts}': ['eslint --cache --ext .js,.ts']
        }
      });
    });
  });

  describe('jsx and typescript', () => {
    beforeAll(() =>
      runTest({
        npmClient: 'npm',
        requireNpmClient: false,
        features: ['jsx', 'ts']
      }).inTmpDir(dir => {
        writePackage(dir);
      })
    );

    it('configures lint-staged', () => {
      assert.jsonFileContent('package.json', {
        'lint-staged': {
          '*.{js,jsx,ts,tsx}': ['eslint --cache --ext .js,.jsx,.ts,.tsx']
        }
      });
    });
  });
});
