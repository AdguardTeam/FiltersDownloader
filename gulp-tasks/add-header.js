const path = require('path');
const gulp = require('gulp');
const header = require('gulp-header');
const { genFileName, packageFile, outputPath } = require('./helpers');

/**
 * Add version copyright header
 */
module.exports = () => {
    const fileName = genFileName(process.env.NODE_ENV);

    console.log('Add copyright header to ' + fileName);

    // using data from package.json
    const pkg = require(packageFile);
    const banner = ['/**',
        ' * <%= pkg.name %> - <%= pkg.description %>',
        ' * @version v<%= pkg.version %>',
        ' * @link <%= pkg.homepage %>',
        ' */',
        ''].join('\n');

    return gulp.src(path.join(outputPath, fileName))
        .pipe(header(banner, { pkg : pkg } ))
        .pipe(gulp.dest(outputPath));
};
