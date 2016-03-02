'use strict';

var gulp = require('gulp')
var webpack = require('gulp-webpack')

gulp.task('webpack', [ 'lint', 'style' ], function() {
  return gulp.src('ui/**/*.js')
    .pipe(webpack(require('../../webpack.config.js')))
    .pipe(gulp.dest('public/'))
})
