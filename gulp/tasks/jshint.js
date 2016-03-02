'use strict';

var gulp = require('gulp')
var jshint = require('gulp-jshint')
var fs = require('fs')

var jshintConfig = JSON.parse(fs.readFileSync(__dirname + '/../../.jshintrc'))

jshintConfig.lookup = false

gulp.task('lint', function() {
  return gulp.src(['./src/**/*.js', './bin/*.js', './ui/**/*.js'])
    .pipe(jshint(jshintConfig))
    .pipe(jshint.reporter('jshint-stylish'))
})
