const gulp = require('gulp');
const concat = require('gulp-concat');
const { src, outputPath, genFileName } = require('./helpers');

/**
 * Compiles src files into one
 */
module.exports = () => {
    let fileName = genFileName(process.env.NODE_ENV);

    console.log(`Build file: ${fileName}`);
    return gulp.src(src)
        .pipe(concat(fileName))
        .pipe(gulp.dest(outputPath));
};
