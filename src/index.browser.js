// This file replaces `index.js` in bundlers like webpack or Rollup,
// according to `browser` config in `package.json`.

const filtersDownloaderCreator = require('./filters-downloader-creator');
const FileDownloadWrapper = require('./browser/file-download-wrapper');

const FiltersDownloader = filtersDownloaderCreator(FileDownloadWrapper);

module.exports = FiltersDownloader;
