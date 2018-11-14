const path = require('path');
const gulp = require('gulp');
const minify = require('gulp-minify');
const { outputPath, genFileName } = require('./helpers');

/**
 * Uglify js.
 */
module.exports = () => {
    const fileName = genFileName(process.env.NODE_ENV);

    return gulp.src(path.join(outputPath, fileName))
        .pipe(minify({
            mangle: false,
            ext: {
                min: '.min.js'
            }
        }))
        .pipe(gulp.dest(outputPath));
};
