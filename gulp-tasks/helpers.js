const src = ['src/main/browser/file-download-wrapper.js', 'src/main/filter-downloader.js'];
const scriptName = 'filter-downloader';
const outputPath = 'build';
const concatFile = 'concat.js';
const ext = '.js';
const packageFile = '../package.json';
const DEV = 'dev';
const PROD = 'prod';

/**
 * Generates fileName depending on process.env.NODE_ENV
 * @param env process.env.NODE_ENV
 * @returns {string} file name
 */
const genFileName = (env) => {
    let fileName;
    switch (env) {
        case PROD:
            fileName = scriptName + ext;
            break;
        case DEV:
        default:
            fileName = scriptName + '.dev' + ext;
            break;
    }
    return fileName;
};

module.exports = {
    src: src,
    scriptName: scriptName,
    outputPath: outputPath,
    concatFile: concatFile,
    ext: ext,
    packageFile: packageFile,
    DEV: 'dev',
    PROD: 'prod',
    genFileName: genFileName,
};
