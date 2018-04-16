# AG Filters

## Filters downloader package

This utility tool resolves preprocessor directives in filter content.

### Directives syntax

```
!#if condition
Anything goes here
!#include URL_or_a_relative_path
!#endif
```

- !#if, !#endif - filters maintainers can use these conditions to supply different rules depending on the ad blocker type.
- condition - just like in some popular programming languages, pre-processor conditions are based on constants declared by ad blockers. Ad blocker authors define on their own what exact constants do they declare.
- !#include - this directive allows to include contents of a specified file into the filter.

#### Logical Conditions
When an adblocker encounters an !#if directive, followed eventually by an !#endif directive, it will compile the code between the directives only if the specified condition is true. Condition supports all the basic logical operators.

Example:
```
!#if (adguard && !adguard_ext_safari)
||example.org^$third-party
!#endif
```

#### Include
The !#include directive supports only files from the same origin to make sure that the filter maintainer is in control of the specified file. The included file can also contain pre-processor directives (even other !#include directives).

Ad blockers should consider the case of recursive !#include and implement a protection mechanism.

Examples:

Filter URL: https://example.org/path/filter.txt

```
!
! Valid (same origin):
!#include https://example.org/path/includedfile.txt
!
! Valid (relative path):
!#include /includedfile.txt
!#include ../path2/includedfile.txt
!
! Invalid (another origin):
!#include https://example.com/path/includedfile.txt
```

## Build
For build run:

    $ gulp build

## Usage

```
const FilterCompilerConditionsConstants = {
    adguard: true,
    ....
    adguard_ext_android_cb: false
};

// Option One
let promise = FilterDownloader.download("resources/rules.txt", FilterCompilerConditionsConstants);
promise.then((compiled) => {
    // Success
}, (exception) => {
    // Error
});

// Option Two
let promise = FilterDownloader.compile(['rule'], 'http://example.com', FilterCompilerConditionsConstants);
promise.then((compiled) => {
    // Success
}, (exception) => {
    // Error
});

```

## Tests

```
/src/test/test-filter-downloader.html
```