const filtersDownloaderCreator = require('./filters-downloader-creator');
const FileDownloadWrapper = require('./node/file-download-wrapper');

const FiltersDownloader = filtersDownloaderCreator(FileDownloadWrapper);

module.exports = FiltersDownloader;
