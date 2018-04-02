/**
 * Compiles src files into one
 */

const gulp = require('gulp');
const gutil = require('gulp-util');

module.exports = () => {
    const options = global.options || {};

    gutil.log('Concat files ' + options.src);

    var concat = require('gulp-concat');

    return gulp.src(options.src)
        .pipe(concat(options.fileName))
        .pipe(gulp.dest(options.outputPath));
};
