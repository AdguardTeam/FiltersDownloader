const fs = require('fs');
const gulp = require('gulp');
const runSequence = require('run-sequence').use(gulp);

const options = global.options = {
    src: ['src/main/browser/file-download-wrapper.js', 'src/main/filter-downloader.js'],
    scriptName: 'filter-downloader',
    outputPath: 'build',
    concatFile: 'concat.js',
    ext: '.js',
    packageFile: '../package.json'
};

gulp.task('build', () => {
    options.fileName = options.scriptName + options.ext;
    runSequence('clean', 'concat', 'add-header', 'uglify');
});

gulp.task('dev', () => {
    options.fileName = options.scriptName + '.dev' + options.ext;
    runSequence('concat');
});

gulp.task('clean', require('./gulp-tasks/clean'));
gulp.task('concat', require('./gulp-tasks/concat'));
gulp.task('add-header', require('./gulp-tasks/add-header'));
gulp.task('uglify', require('./gulp-tasks/uglify'));