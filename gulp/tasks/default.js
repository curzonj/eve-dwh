var gulp = require('gulp')
var watch = require('gulp-watch')
var batch = require('gulp-batch')

gulp.task('default', [ 'lint', 'style' ], function() {
})

gulp.task('watch', function () {
    watch('**/*.js', batch(function (events, done) {
        gulp.start('default', done)
    }))
});
