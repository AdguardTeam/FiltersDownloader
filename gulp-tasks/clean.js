const del = require('del');
const { outputPath } = require('./helpers');

/**
 * Clean build folder.
 */
module.exports = () => {
    console.log(`Cleaning path: "${outputPath}"`);
    return del(outputPath);
};
