/**
 * Add version copyright header
 */

const path = require('path');
const gulp = require('gulp');
const gutil = require('gulp-util');
const header = require('gulp-header');

module.exports = () => {
    const options = global.options || {};

    gutil.log('Add copyright header ' + options.fileName);

    // using data from package.json
    var pkg = require(options.packageFile);
    var banner = ['/**',
        ' * <%= pkg.name %> - <%= pkg.description %>',
        ' * @version v<%= pkg.version %>',
        ' * @link <%= pkg.homepage %>',
        ' */',
        ''].join('\n');

    return gulp.src(path.join(options.outputPath, options.fileName))
        .pipe(header(banner, { pkg : pkg } ))
        .pipe(gulp.dest(options.outputPath));
};
