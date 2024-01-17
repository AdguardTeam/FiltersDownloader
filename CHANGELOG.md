# Filters Downloader Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.6] - 2024-01-17

### Changed

- Updated `@adguard/diff-builder` to 1.0.12.


## [2.0.5] - 2024-01-11

### Changed

- Updated `@adguard/diff-builder` to 1.0.10.


## [2.0.4] - 2024-01-11

### Fixed

- Split lines considering all possible line endings.


## [2.0.3] - 2023-12-29

### Fixed

- Performance regression in resolveInclude


## [2.0.2] - 2023-12-29

### Changed

- Updated `@adguard/diff-builder` to 1.0.8.


## [2.0.1] - 2023-12-29

### Changed

- Updated `@adguard/diff-builder` to 1.0.7.


## [2.0.0] - 2023-12-27

### Added

- TypeScript support.
- Using `@adguard/diff-builder` library to load filters updates by patches.


## [1.1.23] - 2023-11-09

### Fixed

- Cannot add a custom filter list with a .php URL [#1723](https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1723)


## [1.1.21] - 2023-10-20

### Fixed

- Validation of included urls.


## [1.1.20] - 2023-10-10

### Added

- `!#else` pre-processor directive support [#20](https://github.com/AdguardTeam/FiltersDownloader/issues/20).


## [1.1.15] - 2022-11-25

### Fixed

- Too large filter list including [AdGuardForSafari#720](https://github.com/AdguardTeam/AdGuardForSafari/issues/720).


[1.2.0]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.23...v1.2.0
[1.1.23]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.21...v1.1.23
[1.1.21]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.20...v1.1.21
[1.1.20]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.15...v1.1.20
[1.1.15]: https://github.com/AdguardTeam/FiltersDownloader/compare/v1.1.14...v1.1.15
