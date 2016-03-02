'use strict';

var gulp = require('gulp')
var watch = require('gulp-watch')
var batch = require('gulp-batch')

gulp.task('default', ['webpack'], function() {})

gulp.task('watch', function() {
  watch(['**/*.js', '!public/*.js'], batch(function(events, done) {
    gulp.start('default', done)
  }))
});
