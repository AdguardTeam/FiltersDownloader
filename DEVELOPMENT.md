# Development Guide

This guide explains how to set up the development environment, run
`@adguard/filters-downloader` locally, and contribute code.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
    - [1. Clone the repository](#1-clone-the-repository)
    - [2. Install dependencies](#2-install-dependencies)
    - [3. Build the project](#3-build-the-project)
    - [4. Run tests](#4-run-tests)
    - [5. Run the linter](#5-run-the-linter)
- [Available Scripts](#available-scripts)
    - [Running individual Jest tests](#running-individual-jest-tests)
- [Development Workflow](#development-workflow)
    - [Branching](#branching)
    - [Pre-commit hooks](#pre-commit-hooks)
    - [Contribution checklist](#contribution-checklist)
- [Common Tasks](#common-tasks)
    - [Adding a new test](#adding-a-new-test)
    - [Updating a dependency](#updating-a-dependency)
    - [Testing a local build in another project](#testing-a-local-build-in-another-project)
    - [Verifying the dual build](#verifying-the-dual-build)
- [Project Structure Overview](#project-structure-overview)
- [Troubleshooting](#troubleshooting)
    - [`pnpm install` fails with an engine error](#pnpm-install-fails-with-an-engine-error)
    - [Pre-existing lint errors in `_qunit_tests_/`](#pre-existing-lint-errors-in-_qunit_tests_)
    - [Jest tests fail with "Cannot find module"](#jest-tests-fail-with-cannot-find-module)
    - [`pnpm build` fails after dependency update](#pnpm-build-fails-after-dependency-update)
- [Additional Resources](#additional-resources)

## Prerequisites

Install the following tools before you start:

| Tool                             | Version    | Notes                                     |
| -------------------------------- | ---------- | ----------------------------------------- |
| [Node.js](https://nodejs.org/)   | ≥ 20       | CI tests against 20.x, 22.x, and 24.x     |
| [pnpm](https://pnpm.io/)         | 10.7.1     | Install with `npm install -g pnpm@10.7.1` |
| [Git](https://git-scm.com/)      | any recent | —                                         |

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/AdguardTeam/FiltersDownloader.git
cd FiltersDownloader
```

### 2. Install dependencies

```bash
pnpm install
```

This also runs the `prepare` script, which sets up [Husky](https://typicode.github.io/husky/)
pre-commit hooks.

### 3. Build the project

```bash
pnpm build
```

Build outputs go to `dist/`:

- `dist/index.js` — Node.js (CJS)
- `dist/index.browser.js` — Browser (ESM)
- `dist/types/` — TypeScript declaration files

### 4. Run tests

```bash
pnpm test
```

This runs the legacy QUnit suite followed by the Jest suite.

### 5. Run the linter

```bash
pnpm lint
```

This runs ESLint, the TypeScript type checker, and markdownlint in sequence.

## Available Scripts

All scripts are run with `pnpm <script>`.

| Script       | Description                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `build`      | Clean `dist/`, emit declaration files, bundle CJS + ESM with Rollup, and write `build/build.txt`  |
| `watch`      | Rollup in watch mode — rebuilds on file changes                                                   |
| `test`       | Run QUnit tests then Jest tests                                                                   |
| `lint`       | Run `lint:code`, `lint:types`, and `lint:md` in sequence                                          |
| `lint:code`  | ESLint with caching                                                                               |
| `lint:types` | `tsc --noEmit` — type-check without emitting                                                      |
| `lint:md`    | Markdown lint on all `.md` files                                                                  |
| `increment`  | Bump the patch version in `package.json` (no git tag)                                             |
| `tgz`        | Pack a tarball (`filters-downloader.tgz`) for local testing                                       |

### Running individual Jest tests

```bash
# All Jest tests
pnpx jest

# A single test file
pnpx jest __tests__/checksum.test.ts

# Tests matching a name pattern
pnpx jest -t "pattern"
```

## Development Workflow

### Branching

1. Create a feature branch from `master`.
2. Make your changes.
3. Ensure `pnpm lint`, `pnpm test`, and `pnpm build` all pass.
4. Open a pull request against `master`.

### Pre-commit hooks

Husky + lint-staged run automatically on `git commit`:

- **TypeScript / JavaScript files** in `src/`, `scripts/`, and `__tests__/` —
  ESLint and `tsc --noEmit`.
- **Markdown files** — markdownlint.

If the hooks fail, fix the reported issues before committing.

### Contribution checklist

After any code change, follow these steps in order:

1. **Lint:** `pnpm lint` — fix all errors.
2. **Test:** `pnpm test` — all tests must pass.
3. **Add / update tests:** every new or changed behavior needs test coverage
   in `__tests__/`.
4. **Build:** `pnpm build` — must complete without errors.
5. **Changelog:** if the change is user-facing, add an entry to
   [CHANGELOG.md](CHANGELOG.md).

For the full code style rules (TypeScript strict mode, JSDoc requirements,
import conventions, etc.) see the **Code Guidelines** section in
[AGENTS.md](AGENTS.md).

## Common Tasks

### Adding a new test

1. Create or edit a file in `__tests__/` using Jest (`describe`/`it`/`expect`
   from `@jest/globals`). Do not add new QUnit tests.
2. If the test needs HTTP downloads, use the Express integration test server
   defined in `__tests__/server/index.ts`.
3. Place any filter fixture files in `__tests__/fixtures/`, organized by
   scenario in numbered subdirectories.

### Updating a dependency

```bash
pnpm update <package>
```

After updating, run the full verification cycle (`pnpm lint && pnpm test && pnpm build`).

### Testing a local build in another project

```bash
# Pack a tarball
pnpm tgz

# In the consuming project
pnpm add /path/to/FiltersDownloader/filters-downloader.tgz
```

### Verifying the dual build

After `pnpm build`, confirm both entry points exist:

```bash
ls dist/index.js dist/index.browser.js
```

The Node.js build is CJS; the browser build is ESM. Both are configured in
`rollup.config.ts`.

## Project Structure Overview

```text
src/                              # Library source code
  index.ts                        # Node.js entry point
  index.browser.ts                # Browser entry point
  filters-downloader-creator.ts   # Core logic (platform-agnostic)
  checksum.ts                     # MD5 checksum validation
  node/                           # Node.js download wrapper (axios + fs)
  browser/                        # Browser download wrapper (fetch + XHR fallback)
  common/                         # Shared utilities
  helpers/                        # Error reporting with context
__tests__/                        # Jest test suite
  server/                         # Express integration test server
  fixtures/                       # Test fixture filter files and patches
_qunit_tests_/                    # Legacy QUnit tests (do not add new ones)
dist/                             # Build output (git-ignored)
```

For the complete annotated structure see [AGENTS.md](AGENTS.md).

## Troubleshooting

### `pnpm install` fails with an engine error

Ensure your Node.js version is ≥ 20:

```bash
node -v
```

If you use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

### Pre-existing lint errors in `_qunit_tests_/`

The legacy QUnit test files import from `../dist` and produce known ESLint
`import` errors. These are expected — do not introduce new ones, but you can
ignore these specific warnings.

### Jest tests fail with "Cannot find module"

Make sure you have built the project at least once (`pnpm build`) so that
`dist/` exists. The QUnit tests (which run before Jest) import from `dist/`.

### `pnpm build` fails after dependency update

1. Delete `node_modules/` and `dist/`, then reinstall:

    ```bash
    rm -rf node_modules dist
    pnpm install
    pnpm build
    ```

2. If the error persists, check that `rollup.config.ts` externals still match
   the dependency list in `package.json`.

## Additional Resources

- [README.md](README.md) — project overview, directive syntax, and usage
  examples
- [AGENTS.md](AGENTS.md) — architecture, code guidelines, and contribution
  rules for LLM agents
- [CHANGELOG.md](CHANGELOG.md) — release history
- [GitHub repository](https://github.com/AdguardTeam/FiltersDownloader)
- [GitHub Issues](https://github.com/AdguardTeam/FiltersDownloader/issues)
