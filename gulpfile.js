const gulp = require('gulp');
const concatFiles = require('./gulp-tasks/concat');
const clean = require('./gulp-tasks/clean');
const addHeader = require('./gulp-tasks/add-header');
const uglify = require('./gulp-tasks/uglify');

exports.dev = gulp.series(clean, concatFiles);
exports.prod = gulp.series(clean, concatFiles, addHeader, uglify);
