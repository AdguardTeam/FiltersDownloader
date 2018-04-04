/**
 * Uglify js.
 */

const path = require('path');
const gulp = require('gulp');
const minify = require('gulp-minify');

module.exports = () => {
    const options = global.options || {};

    return gulp.src(path.join(options.outputPath, options.fileName))
        .pipe(minify({
            mangle: false,
            ext: {
                min: '.min.js'
            }
        }))
        .pipe(gulp.dest(options.outputPath));
};
