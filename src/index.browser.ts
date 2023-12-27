import {
    type IFiltersDownloader,
    DefinedExpressions,
    FiltersDownloaderCreator,
    type DownloadResult,
} from './filters-downloader-creator';
import {
    getLocalFile,
    getExternalFile,
} from './browser/file-download-wrapper';

const FiltersDownloader = FiltersDownloaderCreator({
    getLocalFile,
    getExternalFile,
});

export {
    FiltersDownloader,
    type DownloadResult,
    type IFiltersDownloader,
    DefinedExpressions,
};
