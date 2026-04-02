# AGENTS.md

## Table of Contents

- [Project Overview](#project-overview)
- [Technical Context](#technical-context)
- [Project Structure](#project-structure)
- [Build And Test Commands](#build-and-test-commands)
- [Contribution Instructions](#contribution-instructions)
- [Code Guidelines](#code-guidelines)
    - [Architecture](#architecture)
    - [Code Quality](#code-quality)
    - [Testing](#testing)
    - [Other](#other)

## Project Overview

`@adguard/filters-downloader` is a utility library that downloads filter
list source files by resolving preprocessor directives. It handles conditional
compilation (`!#if`/`!#else`/`!#endif`), file inclusion (`!#include`), checksum
validation (MD5), and differential (patch-based) filter updates. The library
ships dual builds for Node.js (CJS) and Browser (ESM) environments using a
platform-agnostic core with injected platform-specific file download wrappers.

## Technical Context

| Field                  | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Language / Version     | TypeScript 5.3, targeting ESNext                               |
| Runtime                | Node.js ≥ 20, modern browsers                                  |
| Package Manager        | pnpm 10.7.1                                                    |
| Bundler                | Rollup 4 with `@rollup/plugin-typescript`                      |
| Primary Dependencies   | `axios` (HTTP), `@adguard/diff-builder` (patches), `crypto-js` |
| Testing                | Jest 29 (`@swc/jest` transform) + legacy QUnit suite           |
| Linting                | ESLint 8 (airbnb-typescript + jsdoc plugin)                    |
| Type Checking          | `tsc --noEmit` (strict mode)                                   |
| Pre-commit Hooks       | Husky + lint-staged                                            |
| CI                     | GitHub Actions (`.github/workflows/test.yaml`, `release.yaml`) |
| Storage                | N/A                                                            |
| Project Type           | Library (single package, dual CJS/ESM output)                  |
| Target Platform        | Node.js and Browser                                            |
| Performance Goals      | N/A                                                            |
| Scale / Scope          | Used as a dependency by AdGuard products                       |

## Project Structure

```text
├── src/                              # Library source code
│   ├── index.ts                      # Node.js entry point (re-exports from creator)
│   ├── index.browser.ts              # Browser entry point (re-exports from creator)
│   ├── filters-downloader-creator.ts # Core logic: directive parsing, includes, conditions
│   ├── checksum.ts                   # MD5 checksum calculation and validation
│   ├── common/                       # Shared utilities (content-type validation)
│   ├── helpers/                      # Error reporting with context (logger)
│   ├── node/                         # Node.js file-download wrapper (axios + fs)
│   └── browser/                      # Browser file-download wrapper (fetch + XHR fallback)
├── __tests__/                        # Jest test suite
│   ├── filters-downloader.test.ts
│   ├── checksum.test.ts
│   ├── server/                       # Express test server for integration tests
│   └── fixtures/                     # Test fixture filter files and patches
├── _qunit_tests_/                    # Legacy QUnit test suite
├── scripts/                          # Build helper scripts
│   └── build-txt.ts                  # Writes version info to build/build.txt
├── .github/                          # CI workflows (test, release)
├── bamboo-specs/                     # Bamboo CI pipeline definitions
├── package.json
├── tsconfig.json                     # TypeScript config (includes all sources)
├── tsconfig.build.json               # TypeScript config for production build
├── rollup.config.ts                  # Dual-target Rollup build (Node CJS + Browser ESM)
├── jest.config.ts                    # Jest config with SWC transform
└── .eslintrc.js                      # ESLint config (airbnb-typescript + jsdoc)
```

## Build And Test Commands

| Command          | Description                                      |
| ---------------- | ------------------------------------------------ |
| `pnpm install`   | Install dependencies                             |
| `pnpm build`     | Build Node.js (CJS) and Browser (ESM) to `dist/` |
| `pnpm test`      | Run QUnit tests + Jest tests                     |
| `pnpm lint`      | Run ESLint, TypeScript check, and Markdown lint  |
| `pnpm watch`     | Build in watch mode                              |
| `pnpm increment` | Bump patch version in `package.json`             |
| `pnpm tgz`       | Pack tarball for local testing                   |

To run only Jest tests:

```bash
pnpx jest
```

To run a single Jest test file:

```bash
pnpx jest __tests__/checksum.test.ts
```

## Contribution Instructions

After completing any code change, verify correctness by following these steps:

1. **Run the linter, type checker, and markdown linter.** Execute `pnpm lint`. Fix all errors
   before proceeding. (Note: pre-existing lint errors in `_qunit_tests_/` for
   `../dist` imports are known — do not introduce new ones.)

2. **Run the full test suite.** Execute `pnpm test`. All tests must pass.

3. **Update or add tests.** If you changed or added functionality, add or update
   corresponding tests in `__tests__/`. Every new public function or changed
   behavior must have test coverage.

4. **Build the project.** Execute `pnpm build` and verify it completes
   without errors. The library ships compiled output — confirm the build
   succeeds after your changes.

5. **Follow Code Guidelines.** Verify your code adheres to every rule in the
   Code Guidelines section below.

6. **Update the CHANGELOG.** If the change is user-facing, add an entry to
   `CHANGELOG.md`.

## Code Guidelines

### Architecture

- **Factory pattern with dependency injection.** The core logic lives in
  `FiltersDownloaderCreator`, a factory function that accepts a platform-specific
  `FileDownloadWrapper`. Node.js and browser entry points each provide their own
  wrapper. New platform support follows the same pattern: create a wrapper and
  a new entry point.
- **Keep the core platform-agnostic.** Do not import Node.js builtins (e.g.,
  `fs`, `path`) or browser APIs directly in `filters-downloader-creator.ts`.
  Platform-specific behavior belongs in the wrapper modules.
- **Dual build output.** Node.js build is CJS (`dist/index.js`); browser build
  is ESM (`dist/index.browser.js`). Both are configured in `rollup.config.ts`.

### Code Quality

General code style guidelines are available via link:
<https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md>.

- **TypeScript strict mode.** The project uses `"strict": true`. Do not use
  `any` — provide explicit types.
- All other style rules (indentation, line length, explicit return types, JSDoc,
  Airbnb conventions, unused variables) are enforced by `.eslintrc.js`. Run
  `pnpm lint` to check.

### Testing

- **Jest for new tests.** Write new tests in the `__tests__/` directory using
  Jest (`describe`/`it`/`expect` from `@jest/globals`). Do not add new QUnit
  tests.
- **Integration test server.** The Jest suite starts an Express server
  (`__tests__/server/index.ts`) to serve fixture files. Use it for tests that
  require HTTP downloads.
- **Test fixtures.** Place filter files and patches in `__tests__/fixtures/`.
  Organize by scenario in numbered subdirectories.

### Other

- **Imports use file extensions** in source code. ESLint enforces
  `import/extensions`.
- **Error messages include context.** Use the logger helpers
  (`throwError`, `mergeErrorDetails`) to report errors with surrounding
  filter lines for debuggability.
- **Validate Markdown after editing.** When editing any `.md` file, run
  `pnpm lint:md` to verify the syntax is correct.
