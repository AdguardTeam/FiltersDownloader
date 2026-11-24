import {
    redactErrorCredentials,
    stripUrlCredentials,
    type KnownUrlReplacement,
} from './common/url';
import { resolveIncludePath } from './common/include-path';
import {
    type IFiltersDownloader,
    DefinedExpressions,
    FiltersDownloaderCreator,
    type DownloadResult,
} from './filters-downloader-creator';
import {
    getLocalFile,
    getExternalFile,
    getExternalFileHeaders,
} from './browser/file-download-wrapper';

const FiltersDownloader = FiltersDownloaderCreator({
    getLocalFile,
    getExternalFile,
    getExternalFileHeaders,
});

export {
    FiltersDownloader,
    redactErrorCredentials,
    resolveIncludePath,
    stripUrlCredentials,
    type DownloadResult,
    type IFiltersDownloader,
    DefinedExpressions,
    type KnownUrlReplacement,
};
