/* eslint-disable complexity */
'use strict';
const fs = require('fs');
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
const sortPackageJson = require('sort-package-json');

module.exports = class extends Generator {
  async prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Configuring project with common config!`));

    const pkg = this.fs.readJSON(this.destinationPath('package.json'));

    if (!pkg) {
      this.log(chalk.red('Not a Node.js project'));
      process.exit(1);
    }

    const prompts = [];

    prompts.push({
      type: 'list',
      name: 'npmClient',
      message: 'npm client',
      choices: [
        { value: 'npm', short: 'npm', name: 'use npm' },
        { value: 'npm', short: 'npm', name: 'use yarn' }
      ],
      default: pkg.workspaces || this.fs.exists('yarn.lock') ? 'yarn' : 'npm'
    });

    prompts.push({
      type: 'list',
      name: 'indent',
      message: 'Indentation',
      choices: [
        { value: 2, short: '2 spaces', name: 'Use 2 spaces' },
        { value: '\t', short: 'tabs', name: 'Use tabs' }
      ],
      default: pkg.workspaces || this.fs.exists('yarn.lock') ? 'yarn' : 'npm'
    });

    prompts.push({
      type: 'confirm',
      name: 'requireNpmClient',
      message: 'Add engine requirement for npm client?',
      default: Boolean(pkg.workspaces)
    });

    const hasJsx = Boolean(pkg.dependencies && pkg.dependencies.react);
    const hasTs = this.fs.exists('tsconfig.json');
    prompts.push({
      type: 'checkbox',
      name: 'features',
      message: 'Use features',
      choices: [
        { value: 'jsx', short: 'JSX', name: 'JSX' },
        { value: 'ts', short: 'TS', name: 'TypeScript' }
      ],
      default: [hasJsx && 'jsx', hasTs && 'ts'].filter(feat => feat)
    });

    if (!pkg.author || !/Redwerks/i.test(pkg.author)) {
      prompts.push({
        type: 'confirm',
        name: 'redwerksAuthor',
        message: 'Set Redwerks as author',
        default: true
      });
    }

    const props = await this.prompt(prompts);

    this.pkg = pkg;
    this.props = props;
  }

  writing() {
    this.writePackageJson();
    this.writeSettings();
    this.writePrettier();
  }

  writePackageJson() {
    const {
      npmClient,
      requireNpmClient,
      features,
      redwerksAuthor
    } = this.props;

    const pkg = JSON.parse(JSON.stringify(this.pkg));
    const useWorkspaces = Boolean(pkg.workspaces);

    if (requireNpmClient) {
      pkg.engines = pkg.engines || {};
      if (npmClient === 'yarn') {
        pkg.engines.npm = 'use yarn';
      } else {
        pkg.engines.yarn = 'use npm';
      }
    }

    pkg.husky = pkg.husky || {};
    pkg.husky.hooks = pkg.husky.hooks || {};
    pkg.husky.hooks['pre-commit'] = [
      'lint-staged',
      useWorkspaces
        ? 'yarn workspaces run license-validator'
        : 'license-validator'
    ].join(' && ');

    const ts = features.includes('ts');
    const jsx = features.includes('jsx');
    const exts = ['js', jsx && 'jsx', ts && 'ts', ts && jsx && 'tsx'].filter(
      ext => ext
    );

    const grepScripts = '*.{' + exts.join(',') + '}';
    const scriptExts = exts.map(ext => '.' + ext).join(',');

    pkg['lint-staged'] = pkg['lint-staged'] || {};
    pkg['lint-staged'][grepScripts] = pkg['lint-staged'][grepScripts] || [];
    pkg['lint-staged'][grepScripts] = pkg['lint-staged'][grepScripts].filter(
      cmd => !/eslint/.test(cmd)
    );
    pkg['lint-staged'][grepScripts].unshift(
      `eslint --cache --ext ${scriptExts}`
    );

    pkg.scripts = pkg.scripts || {};

    if (useWorkspaces) {
      pkg.bootstrap = 'lerna bootstrap --use-workspaces';
    }

    const extraJson = [
      'lerna.json',
      '.babelrc.json',
      'tsconfig.json'
    ].filter(jsonFile => this.fs.exists(jsonFile));

    pkg.scripts.lint = `eslint --cache '${grepScripts}' --ext ${scriptExts}`;
    if (pkg.dependencies && pkg.dependencies.gatsby) {
      pkg.scripts.pretty = `prettier --write ${[
        '**/*.{' + [exts, 'json', 'md'].join(',') + '}'
      ].join(' ')}`;
    } else {
      pkg.scripts.pretty = `prettier --write ${[
        `'${grepScripts}'`,
        ...extraJson
      ].join(' ')}`;
    }

    if (useWorkspaces) {
      pkg.scripts.license = 'yarn workspaces run license-validator -i';
    }

    if (redwerksAuthor) {
      if (pkg.author) {
        pkg.contributors = [pkg.author, ...(pkg.contributors || [])];
      }

      pkg.author = 'Redwerks (https://redwerks.org/)';
    }

    fs.writeFileSync(
      this.destinationPath('package.json'),
      sortPackageJson(JSON.stringify(pkg, null, 2))
    );
  }

  writeSettings() {
    const { indent } = this.props;

    // Auto-configure typical vscode workspace settings
    this.fs.extendJSON(this.destinationPath('.vscode/settings.json'), {
      'editor.insertSpaces': indent !== '\t',
      'editor.tabSize': indent === '\t' ? 4 : indent,
      'debug.node.autoAttach': 'on',
      'editor.formatOnSave': true
    });
  }

  writePrettier() {
    // Only setup .prettierrc if it isn't already configured
    // Gatsby projects use different settings, so we don't want to override those
    const prettierrc = this.destinationPath('.prettierrc');
    if (!this.fs.exists(prettierrc)) {
      const { indent } = this.props;

      this.fs.writeJSON(prettierrc, {
        tabWidth: indent === '\t' || indent === 2 ? undefined : indent,
        useTabs: indent === '\t' ? true : undefined,
        singleQuote: true,
        trailingComma: 'all'
      });
    }

    const prettierignore = this.destinationPath('.prettierignore');
    if (!this.fs.exists(prettierignore)) {
      this.fs.write(prettierignore, 'node_modules/\n');
    }
  }

  async install() {
    const { npmClient } = this.props;

    const devDeps = ['prettier'];
    if (!this.pkg.dependencies || !this.pkg.dependencies.gatsby) {
      devDeps.push('husky', 'lint-staged');
    }

    if (npmClient === 'yarn') await this.yarnInstall(devDeps, { dev: true });
    else await this.npmInstall(devDeps, { saveDev: true });
  }
};
