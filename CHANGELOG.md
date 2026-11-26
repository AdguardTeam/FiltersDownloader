# Filters Downloader Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `redactErrorCredentials` and `resolveIncludePath` are exported from the
  package root and the browser entry point. The `KnownUrlReplacement` type is
  exported too. `redactErrorCredentials` accepts an optional `knownUrl`
  argument, a URL whose userinfo can contain any character or a list of
  `[value, sanitizedValue]` replacements.
- `stripUrlCredentials` accepts an optional `isSchemaless` argument. When it
  is `true`, the function also removes userinfo from a value without a scheme,
  for example `sub/user:pass@example.org/filter.txt`. The default is `false`,
  so existing calls keep the same behavior.

### Changed

- **Breaking:** The minimum supported Node.js version is now
  `^22.23.5 || ^24.22.3 || >=26.13.1`: 22.23.5 for 22.x, 24.22.3 for 24.x, and
  26.13.1 for 26.x and newer. Older releases on these lines are vulnerable to
  CVE-2026-111497, fixed in 22.23.4, 24.22.1 and 26.12.1, and to the
  vulnerabilities fixed in the November 2026 security releases. The 22.x floor
  is 22.23.5, the Node.js version the CI image runs.

### Deprecated

### Removed

### Fixed

- An unspaced `!#if` operator no longer drops the last character of the left
  operand. For example, `!#if adguard&&adguard_ext_chromium` and
  `!#if adguard||unknown_platform` now resolve the condition correctly.
- `!#include` and local file error messages no longer show the userinfo
  component of a value without a scheme, for example
  `!#include user:pass@example.org/include.txt`, an `!#include` with no space
  before the target, or a local path that contains such a value. The redaction
  covers the directive line, the context lines, the filter URL, and the
  original error. A comment line is redacted too, because a comment is not a
  filtering rule. The browser build redacts a scheme-less url in the same way.
- An error message for an `!#include` that is resolved against a URL origin no
  longer shows the userinfo that the target put into the path of the resolved
  URL, for example
  `!#include sub/user:pass@example.org/missing.txt`. The message, the stack, and
  a nested error's `URL:` line contain the redacted resolved URL.
- An empty `!#if` operand now throws `Invalid directives: Empty condition` for
  every form, for example `!#if adguard||`, `!#if adguard &&`, `!#if ||adguard`,
  and `!#if &&adguard`, regardless of the other operand.

### Security

## [3.1.1] - 2026-11-23

### Changed

- Updated [@adguard/diff-builder] to 1.1.9.

### Fixed

- `stripUrlCredentials` now removes a password that starts with digits and then
  contains `?` or `#`, for example `admin:2024#Secret1` or
  `admin:2024#Se/cret`, including a password without a username, for example
  `https://:2024#Se/cret@example.org`. Error messages and
  local-path errors no longer show such a password. The URL parser still leaves
  such a value unchanged, so the request target stays the same. The redaction
  keeps a path, query, or fragment that follows the host and otherwise ends at
  the last at sign in the URL token, so a password that itself contains an at
  sign is removed too. A token with a later at sign and no path, query, or
  fragment delimiter is removed up to the last at sign even when no host
  remains, for example `https://admin:2024#Se@cret@` now shows `https://`. Text
  after the URL stays unless an at sign follows it:
  the text between the URL and that at sign can belong to a password, so the
  redaction removes it together with the at sign. For example,
  `https://admin:2024#Secret1@example.org?a@b` now shows
  `https://example.org?a@b`, `https://fileserver:8080?x@example.org&y@z`
  shows `https://z`, and
  `Read https://admin:2024#Secret1@ and user@example.com now` shows
  `Read https://example.com now`. When a statement continues after a quoted
  URL, the removed text can include the closing quote:
  `Failed to request 'https://a:1#b' for admin@example.org` shows
  `Failed to request 'https://example.org`. A valid URL
  whose host is `localhost`, or whose single-label host has a numeric port and
  an at sign in the query or fragment with no path after the port, for example
  `https://localhost:8080#contact@example.org` and
  `https://fileserver:8080#x@example.org`, now shows `https://example.org`,
  because a leak is worse than a wrong host in display text. A path after the
  port keeps the value unchanged, for example
  `https://myhost:8080/path?email=user@example.com`. A password whose username
  contains a dot still cannot be told from a dotted host with a port, so such
  a value stays unchanged.

## [3.1.0] - 2026-11-16

### Added

- `stripUrlCredentials` is exported from the package root and the browser
  entry point. It removes the userinfo component from URLs in logs, error
  messages, and other display text without changing the URL used for a
  request.

### Fixed

- A relative `!#include` path that escapes the directory of the file containing
  the directive is now ignored instead of being downloaded or failing the
  filter update. The filter list still compiles, as in uBO
  [FiltersDownloader#27].
- Credentials from malformed source URLs no longer appear in error messages,
  stacks, causes, or other error properties. The URL parser recognizes
  `https:/`, `https:`, `https:\` and `https:///` forms, passwords with `?`,
  `#`, or spaces, and a username with a space. A password that starts with `?`
  or `#` is recognized too, including for a single-label host followed by a
  path, a query, a fragment, or the end of the value. An at sign in a query or
  fragment is no longer mistaken for credentials when the host has a dot. A
  valid URL whose single-label host has an empty port and an at sign in the
  query is read as credentials, because a leak is worse than a wrong host.
  Credentials inside a local path are removed from the
  error path as well as from the message. Nested plain objects and arrays in a
  cause chain are redacted too. Rule syntax after `//` in an error context is
  no longer shortened. A password that starts with digits and then contains
  `?` or `#` still cannot be told from a port and a fragment, so the parser
  leaves it as is.

## [3.0.1] - 2026-10-30

### Fixed

- The Node.js build no longer fails to download a source URL that contains
  credentials. The build now sends the credentials in an `Authorization: Basic`
  header, as versions before 3.0.0 did. Patch updates are skipped for such URLs,
  so the full filter is downloaded.
- The Node.js build now reports the source URL when reading a response body
  fails. The original error is kept as the error cause.

## [3.0.0] - 2026-10-26

## [3.0.0-beta.0] - 2026-10-23

### Changed

- **Breaking:** The Node.js build now requires Node.js 22.21+ (22.x) or 24+.
  Node.js 20 has no built-in proxy support for `fetch` [FiltersDownloader#35].
- **Breaking:** Stopped picking up a proxy from `HTTP_PROXY`, `HTTPS_PROXY` and
  `NO_PROXY` in the Node.js build on its own. To download through a proxy, set
  `NODE_USE_ENV_PROXY=1` [FiltersDownloader#35].
- **Breaking:** Removed the unused `allowEmptyResponse` argument from the
  `downloadWithRaw` method type. Use `options.allowEmptyResponse` instead.

### Removed

- Removed the `axios` dependency. The Node.js build downloads filters with the
  built-in `fetch`. This change also removes the vulnerable pinned `axios`
  version [FiltersDownloader#34] [FiltersDownloader#35].

### Fixed

- The browser build now retries an external filter download once after a
  transient network error.
- Fixed the Node.js build returning a filter whose content looks like JSON,
  such as `[]` or `123`, as a parsed value instead of a string
  [FiltersDownloader#35].
- A successful download no longer fails when the response URL is empty or
  cannot be parsed. The `Content-Type` and `Last-Modified` headers are still
  used when they are available.
- The browser build no longer reads response headers for local URLs whose
  response URL is reported, so an `XMLHttpRequest` implementation that throws
  from `getResponseHeader()` for such files no longer fails the download.
- Fixed the browser build failing with a `TypeError` on an empty local file.
  It now throws `Response is empty`, or returns an empty filter with
  `allowEmptyResponse`.
- Removed the redundant `Pragma: no-cache` and `Content-Type` request headers
  from browser downloads. The `Pragma` header caused CORS preflight requests
  that some filter hosts reject.

## [2.4.5] - 2026-07-14

## [2.4.3] - 2026-04-03

### Added

- `headers` property to `DownloadResult` with the `Last-Modified` HTTP response
  header from filter downloads [AdguardBrowserExtension#3407].

### Changed

- Updated [@adguard/diff-builder] to 1.1.4.

[2.4.3]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.4.2...v2.4.3
[AdguardBrowserExtension#3407]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3407

## [2.4.2] - 2025-06-30

### Changed

- Updated [@adguard/diff-builder] to 1.1.2.

[2.4.2]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.4.1...v2.4.2

## [2.4.1] - 2025-06-09

### Changed

- Updated [@adguard/diff-builder] to 1.1.1.

[2.4.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.4.0...v2.4.1

## [2.4.0] - 2025-03-27

### Changed

- Updated [@adguard/diff-builder] to 1.1.0.

[2.4.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.3.1...v2.4.0

## [2.3.1] - 2025-03-11

### Added

- `allowEmptyResponse` option for download empty files. [HostlistCompiler#85]

[2.3.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.3.0...v2.3.1
[HostlistCompiler#85]: https://github.com/AdguardTeam/HostlistCompiler/issues/85

## [2.3.0] - 2025-03-06

### Fixed

- `filterOrigin` path duplication while download local file. [HostlistCompiler#82]

[2.3.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.6...v2.3.0
[HostlistCompiler#82]: https://github.com/AdguardTeam/HostlistCompiler/issues/82

## [2.2.6] - 2024-12-13

### Changed

- Better description of exported types in package.json.

[2.2.6]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.4...v2.2.6

## [2.2.4] - 2024-12-06

### Changed

- Improved error message during `!#include` and condition directives resolving [FiltersCompiler#213].

[2.2.4]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.3...v2.2.4
[FiltersCompiler#213]: https://github.com/AdguardTeam/FiltersCompiler/issues/213

## [2.2.3] - 2024-11-25

### Added

- Ability to add filters from Google Drive [AdguardBrowserExtension#2908].

[2.2.3]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.2...v2.2.3
[AdguardBrowserExtension#2908]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2908

## [2.2.2] - 2024-07-11

### Added

- `adguard_ext_chromium_mv3` optional property to the `DefinedExpressions` type.

[2.2.2]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.1...v2.2.2

## [2.2.1] - 2024-05-22

### Changed

- Improved error handling during include directives resolving.

[2.2.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.2.0...v2.2.1

## [2.2.0] - 2024-03-26

### Changed

- rawFilter is returned as a string, so that new lines can be preserved.

[2.2.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.1.2...v2.2.0

## [2.1.2] - 2024-03-25

### Added

- `isPatchUpdateFailed` flag in the result of `downloadWithRaw()` method to indicate
  that patch application failed [AdguardBrowserExtension#2717].

### Changed

- Updated [@adguard/diff-builder] to 1.0.17.

[2.1.2]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.1.1...v2.1.2
[AdguardBrowserExtension#2717]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2717

## [2.1.1] - 2024-03-13

### Changed

- Added validation of checksums for filters updates.

[2.1.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.7...v2.1.1

## [2.0.7] - 2024-01-17

### Changed

- Updated [@adguard/diff-builder] to 1.0.13.

[2.0.7]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.6...v2.0.7

## [2.0.6] - 2024-01-17

### Changed

- Updated [@adguard/diff-builder] to 1.0.12.

[2.0.6]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.5...v2.0.6

## [2.0.5] - 2024-01-11

### Changed

- Updated [@adguard/diff-builder] to 1.0.10.

[2.0.5]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.4...v2.0.5

## [2.0.4] - 2024-01-11

### Fixed

- Split lines considering all possible line endings.

[2.0.4]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.3...v2.0.4

## [2.0.3] - 2023-12-29

### Fixed

- Performance regression in resolveInclude

[2.0.3]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.2...v2.0.3

## [2.0.2] - 2023-12-29

### Changed

- Updated [@adguard/diff-builder] to 1.0.8.

[2.0.2]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.1...v2.0.2

## [2.0.1] - 2023-12-29

### Changed

- Updated [@adguard/diff-builder] to 1.0.7.

[2.0.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.0.0...v2.0.1

## [2.0.0] - 2023-12-27

### Added

- TypeScript support.
- Using [@adguard/diff-builder] library to load filters updates by patches.

[2.0.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.23...v2.0.0

## [1.1.23] - 2023-11-09

### Fixed

- Cannot add a custom filter list with a .php URL [AdguardBrowserExtension#1723].

[1.1.23]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.21...v1.1.23
[AdguardBrowserExtension#1723]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1723

## [1.1.21] - 2023-10-20

### Fixed

- Validation of included urls.

[1.1.21]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.20...v1.1.21

## [1.1.20] - 2023-10-10

### Added

- `!#else` pre-processor directive support [#20].

[#20]: https://github.com/AdguardTeam/FiltersDownloader/issues/20
[1.1.20]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.15...v1.1.20

## [1.1.15] - 2022-11-25

### Fixed

- Too large filter list including [AdGuardForSafari#720](https://github.com/AdguardTeam/AdGuardForSafari/issues/720).

[1.1.15]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.14...v1.1.15

[@adguard/diff-builder]: https://github.com/AdguardTeam/DiffBuilder/blob/master/CHANGELOG.md

[Unreleased]: https://github.com/AdguardTeam/FiltersDownloader/compare/v3.1.1...HEAD
[3.1.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v3.0.1...v3.1.0
[3.0.1]: https://github.com/AdguardTeam/FiltersDownloader/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v3.0.0-beta.0...v3.0.0
[3.0.0-beta.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.4.5...v3.0.0-beta.0

[2.4.5]: https://github.com/AdguardTeam/FiltersDownloader/compare/v2.4.4...v2.4.5

[FiltersDownloader#34]: https://github.com/AdguardTeam/FiltersDownloader/issues/34
[FiltersDownloader#35]: https://github.com/AdguardTeam/FiltersDownloader/issues/35
[FiltersDownloader#27]: https://github.com/AdguardTeam/FiltersDownloader/issues/27
