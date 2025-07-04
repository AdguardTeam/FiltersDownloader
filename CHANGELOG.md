# Filters Downloader Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
