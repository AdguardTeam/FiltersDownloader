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
    type DownloadResult,
    type IFiltersDownloader,
    DefinedExpressions,
};
