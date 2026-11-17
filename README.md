# @adguard/filters-downloader

A library that downloads filter list source files by resolving
preprocessor directives. It handles conditional compilation, file inclusion,
checksum validation, and differential (patch-based) filter updates. The library
works in both Node.js and browser environments.

> **Note:** This package is developed in
> [AdGuardSoftwareLimited/ext-filters-downloader](https://github.com/AdGuardSoftwareLimited/ext-filters-downloader).
> The [AdguardTeam/FiltersDownloader](https://github.com/AdguardTeam/FiltersDownloader)
> repository is a public mirror.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
    - [Importing](#importing)
- [Key Concepts](#key-concepts)
    - [Condition constants](#condition-constants-definedexpressions)
    - [Preprocessor directives](#preprocessor-directives)
    - [Checksums](#checksums)
    - [Differential updates](#differential-updates)
- [API Reference](#api-reference)
    - [`download()`](#downloadurl-definedexpressions-options)
    - [`downloadWithRaw()`](#downloadwithrawurl-options)
    - [`compile()`](#compilerules-filterorigin-definedexpressions)
    - [`resolveConditions()`](#resolveconditionsrules-definedexpressions)
    - [`resolveIncludes()`](#resolveincludesrules-filterorigin-definedexpressions)
    - [`getFilterUrlOrigin()`](#getfilterurloriginurl)
    - [`stripUrlCredentials()`](#stripurlcredentialsurl)
- [Documentation](#documentation)
- [Projects using FiltersDownloader](#projects-using-filtersdownloader)

## Overview

Filter lists used by ad blockers are often composed of multiple source files
and contain platform-specific rules gated behind preprocessor directives. This
library takes a filter URL (or an array of rules) and produces a flat,
ready-to-use list of rules by:

- **Resolving `!#include` directives** — fetches and inlines referenced files
- **Resolving `!#if`/`!#else`/`!#endif` directives** — includes or excludes rule
  blocks based on caller-provided condition constants
- **Validating checksums** — optionally verifies the MD5 checksum embedded in
  the filter header
- **Applying differential updates** — when a previously downloaded raw filter is
  supplied, attempts to update it via a binary patch instead of a full
  re-download

## Installation

```bash
pnpm add @adguard/filters-downloader
# or
npm install @adguard/filters-downloader
# or
yarn add @adguard/filters-downloader
```

### Importing

**Node.js (CommonJS / ESM):**

```js
import { FiltersDownloader } from '@adguard/filters-downloader';
```

**Browser (ESM):**

```js
import { FiltersDownloader } from '@adguard/filters-downloader/browser';
```

## Key Concepts

### Condition constants (`DefinedExpressions`)

When compiling a filter, you pass a `DefinedExpressions` object that declares
which platform constants are `true` for the current ad blocker. The library
evaluates `!#if` expressions against these constants and includes only the rules
that apply to your platform.

Recognized constants:

| Constant                   | Description                         |
| -------------------------- | ----------------------------------- |
| `adguard`                  | AdGuard product (any)               |
| `adguard_ext_chromium`     | AdGuard for Chromium-based browsers |
| `adguard_ext_chromium_mv3` | AdGuard for Chromium MV3            |
| `adguard_ext_firefox`      | AdGuard for Firefox                 |
| `adguard_ext_edge`         | AdGuard for Edge                    |
| `adguard_ext_safari`       | AdGuard for Safari                  |
| `adguard_ext_opera`        | AdGuard for Opera                   |
| `adguard_ext_android_cb`   | AdGuard for Android Content Blocker |

Any constant not present in the `DefinedExpressions` object is treated as
`false`. See the [AdGuard conditions directive docs][conditions-directive] for
the full list of recognized constants.

[conditions-directive]: https://adguard.com/kb/general/ad-filtering/create-own-filters/#conditions-directive

### Preprocessor directives

#### Conditional blocks

```adblock
!#if (adguard && !adguard_ext_safari)
||example.org^$third-party
!#endif
```

```adblock
!#if adguard_ext_firefox
!#include https://example.org/path/firefox-rules.txt
!#else
!#include https://example.org/path/other-rules.txt
!#endif
```

- `!#if` / `!#else` / `!#endif` delimit conditional blocks.
- Conditions support `&&`, `||`, `!`, and parentheses.
- Only the block whose condition evaluates to `true` is included in the output.

#### File inclusion

```adblock
!
! Valid (same origin, absolute URL):
!#include https://example.org/path/includedfile.txt
!
! Valid (relative to the directory of the file that contains the directive):
!#include includedfile.txt
!#include subdirectory/includedfile.txt
!
! Valid (root-absolute path inside that directory):
!#include /includedfile.txt
!
! Ignored (outside the directory of the file that contains the directive):
!#include ../path2/includedfile.txt
!
! Invalid (different origin — rejected):
!#include https://example.com/path/includedfile.txt
```

`!#include` fetches the referenced file and splices its rules into the output at
that position. Included files may themselves contain directives. A relative path
resolves against the directory of the file that contains the directive.

A path that starts with `/` is root-absolute. The library ignores the leading
slash, so the path resolves inside the directory of the file that contains the
directive. This is the same for remote and local sources and matches the
behavior of uBO and previous versions.

A relative or root-absolute include must stay inside that directory. The
library ignores an include that points outside this directory, including a path
that escapes it with `..`, a percent-encoded dot segment, or an encoded path
separator. The library does not fetch the file and the rest of the filter still
compiles.

An absolute URL from the same origin is allowed from any directory. An absolute
URL from a different origin is rejected.

### Checksums

A filter file may embed an MD5 checksum in its header (e.g.
`! Checksum: <base64-md5>`). When `validateChecksum: true` is passed, the
library verifies the checksum after downloading. Use `validateChecksumStrict:
true` to treat a missing checksum as an error.

### Differential updates

`downloadWithRaw` keeps the raw (uncompiled) filter text alongside the compiled
output. On subsequent calls, passing the previously stored `rawFilter` lets the
library apply a binary patch (if the server provides one) instead of downloading
the entire filter again, reducing bandwidth usage.

For a source URL that contains credentials, the library always downloads the
full filter. Only the Node.js build supports such URLs.

## API Reference

All methods are on the `FiltersDownloader` object. The package also exports
the `stripUrlCredentials` helper for display text.

### `download(url, definedExpressions?, options?)`

Downloads a filter from `url`, resolves all directives, and returns the compiled
rules as a `string[]`.

```ts
const rules: string[] = await FiltersDownloader.download(
    'https://example.org/filter.txt',
    { adguard: true, adguard_ext_firefox: true },
);
```

**Options** (`LegacyDownloadOptions`):

| Option                   | Type      | Default | Description                            |
| ------------------------ | --------- | ------- | -------------------------------------- |
| `validateChecksum`       | `boolean` | `false` | Verify the embedded MD5 checksum       |
| `validateChecksumStrict` | `boolean` | `false` | Error if no checksum is present        |
| `allowEmptyResponse`     | `boolean` | `false` | Allow downloading an empty filter file |

By default an empty top-level response throws `'Response is empty'`. Included
files may be empty regardless of this option.

---

### `downloadWithRaw(url, options)`

Downloads a filter and returns both the compiled rules and the raw (uncompiled)
filter text. On subsequent calls, supply the stored `rawFilter` so the library
can apply a differential patch instead of a full re-download.

```ts
// First download — no previous raw filter
const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(
    'https://example.org/filter.txt',
    { definedExpressions: { adguard: true } },
);

// Store rawFilter and use it next time
const { filter: updated, rawFilter: newRaw, isPatchUpdateFailed } =
    await FiltersDownloader.downloadWithRaw(
        'https://example.org/filter.txt',
        {
            rawFilter,           // previously stored raw filter
            definedExpressions: { adguard: true },
        },
    );
```

**Returns** (`DownloadResult`):

| Field                 | Type                   | Description                                                                    |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `filter`              | `string[]`             | Compiled rules                                                                 |
| `rawFilter`           | `string`               | Raw filter text before directive resolution                                    |
| `isPatchUpdateFailed` | `boolean \| undefined` | `true` if a patch was attempted but failed (full re-download was used instead) |
| `headers`             | `object \| undefined`  | HTTP response headers from the filter download (see below)                     |

`headers` shape:

| Field          | Type                  | Description                                           |
| -------------- | --------------------- | ----------------------------------------------------- |
| `lastModified` | `string \| undefined` | The value of the `Last-Modified` HTTP response header |

> **Note:** `headers.lastModified` can be used as a fallback update timestamp
> when filter metadata does not contain a `TimeUpdated` field.

**Options** (`DownloadWithRawOptions`):

| Option                   | Type                  | Default     | Description                                     |
| ------------------------ | --------------------- | ----------- | ----------------------------------------------- |
| `force`                  | `boolean`             | `false`     | Skip patch attempt and force a full re-download |
| `rawFilter`              | `string`              | `undefined` | Previously stored raw filter to diff against    |
| `definedExpressions`     | `DefinedExpressions`  | `undefined` | Condition constants for directive resolution    |
| `validateChecksum`       | `boolean`             | `false`     | Verify the embedded MD5 checksum                |
| `validateChecksumStrict` | `boolean`             | `false`     | Error if no checksum is present                 |
| `allowEmptyResponse`     | `boolean`             | `false`     | Allow an empty filter response                  |
| `verbose`                | `boolean`             | `false`     | Enable detailed logging for troubleshooting     |

---

### `compile(rules, filterOrigin?, definedExpressions?)`

Resolves all directives in an already-fetched `string[]` of rules. Useful when
you have the raw lines in memory and do not need an HTTP download.

```ts
const rawRules = [
    '!#if adguard_ext_firefox',
    '||firefox-only.example.org^',
    '!#endif',
    '||example.org^',
];

const compiled: string[] = await FiltersDownloader.compile(
    rawRules,
    'https://example.org/filter.txt', // used to resolve relative !#include paths
    { adguard_ext_firefox: true },
);
// → ['||firefox-only.example.org^', '||example.org^']
```

---

### `resolveConditions(rules, definedExpressions?)`

Evaluates `!#if` / `!#else` / `!#endif` directives and returns a new `string[]`
with non-matching blocks removed. Does **not** fetch `!#include` references.

```ts
const filtered = FiltersDownloader.resolveConditions(rules, { adguard: true });
```

---

### `resolveIncludes(rules, filterOrigin?, definedExpressions?)`

Fetches and inlines all `!#include` references. Does **not** evaluate
`!#if` conditions.

```ts
const expanded = await FiltersDownloader.resolveIncludes(
    rules,
    'https://example.org/filter.txt',
    { adguard: true },
);
```

---

### `getFilterUrlOrigin(url)`

Returns the base directory URL of `url` (everything up to and including the last
`/`). Used internally to resolve relative `!#include` paths.

```ts
FiltersDownloader.getFilterUrlOrigin('https://example.org/path/filter.txt');
// → 'https://example.org/path'
```

---

### `stripUrlCredentials(url)`

Removes the userinfo component from every URL in `url`, including the password.
Use this function for log messages, error messages, and other display text. It
does not change the URL that the library uses for a request.

```ts
import { stripUrlCredentials } from '@adguard/filters-downloader';

stripUrlCredentials('https://user:password@example.org/filter.txt');
// → 'https://example.org/filter.txt'

stripUrlCredentials('https://user:pa#ss@example.org/filter.txt');
// → 'https://example.org/filter.txt'
```

The function accepts a whole message and removes the userinfo from every URL
in it. It also removes malformed credentials that the WHATWG URL parser does
not detect, for example a password that contains `?` or `#`, including when
the host is a single label followed by a query, a fragment, or the end of the
value.

The function keeps a valid URL with a port and an at sign in the query or
fragment unchanged when the host has a dot or is an IPv6 literal. A valid URL
whose host is `localhost`, or whose single-label host has an empty or numeric
port and an at sign in the query or fragment, for example
`https://localhost:8080#contact@example.org` and
`https://fileserver:8080#x@example.org`, is read as credentials, because a
leak is worse than a wrong host in display text. In the digit-first form the
redaction keeps a path, query, or fragment that follows the host and otherwise
ends at the last at sign in the URL token, so a password that itself contains
an at sign is removed too, while prose after the URL is not included. For
example, `https://admin:2024#Secret1@example.org?a@b` becomes
`https://example.org?a@b`, while
`https://fileserver:8080?x@example.org&y@z` becomes `https://z`. A password
whose username contains a dot still cannot be told from a dotted host with a
port, so such a value stays unchanged. The function also keeps rule syntax
after `//` unchanged, for example `//scriptlet(...)` and `//*[@id="x"]`.

The browser entry point exports the same function:

```ts
import { stripUrlCredentials } from '@adguard/filters-downloader/browser';
```

> **Note:** Use the original URL for requests. The helper is for display only.

## Documentation

- [Changelog](CHANGELOG.md)
- [Development](DEVELOPMENT.md)
- [LLM agent rules](AGENTS.md)

## Projects using FiltersDownloader

- [AdguardBrowserExtension] — AdGuard browser extension
- [FiltersCompiler] — compiles AdGuard filter lists from sources
- [HostlistCompiler] — compiles hosts blocklists from multiple sources
- [TSUrlFilter monorepo] — [adguard-api] package

[AdguardBrowserExtension]: https://github.com/AdguardTeam/AdguardBrowserExtension
[FiltersCompiler]: https://github.com/AdguardTeam/FiltersCompiler
[HostlistCompiler]: https://github.com/AdguardTeam/HostlistCompiler
[TSUrlFilter monorepo]: https://github.com/AdguardTeam/tsurlfilter
[adguard-api]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/adguard-api
