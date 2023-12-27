import {
    type IFiltersDownloader,
    DefinedExpressions,
    FiltersDownloaderCreator,
    type DownloadResult,
} from './filters-downloader-creator';
import {
    getLocalFile,
    getExternalFile,
} from './node/file-download-wrapper';

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
