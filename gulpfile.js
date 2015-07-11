var child_process = require('child_process')
var gulp          = require('gulp');
var watch         = require('gulp-watch');
var tar           = require('gulp-tar');
var plumber       = require('gulp-plumber');
var gutil         = require('gulp-util');

var boot2dockerWasRunning = false;
 
//////
// Get development environment up and running
//////
gulp.task('up', ['docker-up', 'watch'], function () {
  // Only dependencies executed
})

//////
// Catch Ctrl-C to clean up
// E.g. stop docker
//////
process.on('SIGINT', function() {
  // Stop docker-compose
  gutil.log('Stopping docker-compose');
  child_process.spawnSync('docker-compose', ['stop'], { stdio: 'pipe' });
  // Stop boot2docker if it wasn't running
  if (process.platform === 'darwin' && ! boot2dockerWasRunning) {
    gutil.log('Stopping boot2docker');
    child_process.spawnSync('boot2docker', ['down'], { stdio: 'pipe' });
  }
  // Quit
  process.exit();
});

/////
// Start docker
/////
gulp.task('docker-up', ['tar'], function() {
  // If on Mac, start boot2docker if needed
  if (process.platform === 'darwin') {
    var b2dstatus = child_process.spawnSync('boot2docker', ['status'], { stdio: 'pipe' })
    boot2dockerWasRunning = b2dstatus.stdout.toString().indexOf('running') === 0;
    if (! boot2dockerWasRunning) {
      gutil.log('Starting boot2docker (was not running)');
      child_process.spawnSync('boot2docker', ['up'], { stdio: 'inherit' });
    }
    child_process.spawnSync('eval', ['"$(boot2docker shellinit)"'], { stdio: 'pipe' });  
  }
  // Start docker-compose
  gutil.log('Starting docker-compose');
  child_process.spawn('docker-compose', ['up'], { stdio: 'inherit' });  
});

/////
// Pack current directory (for swift copy to docker container)
/////
gulp.task('tar', function () {
    return gulp.src(['**/*', '**/.*', '!tmp/**'])
        .pipe(tar('init.tar'))
        .pipe(gulp.dest('tmp'));
});

//////
/// Watch for changes
//////
gulp.task('watch', ['docker-up'], function() {
  watch(['**/*', '**/.*', '!tmp/**'], function(file) {
    gutil.log('watch: ' + file.event + ' ' + file.relative);
    if (file.event === 'unlink') {
      child_process.exec('docker exec neepblogfrontend_ember_1 rm /myapp/'+file.relative, { stdio: 'inherit' }, log_errors);
    }
    else {
      child_process.exec('docker exec neepblogfrontend_ember_1 cp /tmp/myapp/'+file.relative+' /myapp/'+file.relative, { stdio: 'inherit' }, log_errors);
    }
  });
});

/////
/// Utility functions
/////
function log_errors(error, stdout, stderr) {
  if (error !== null) {
    gutil.log('exec error: ' + error);
    gutil.log('stdout: ' + stdout);
    gutil.log('stderr: ' + stderr);
  }
}

var gulp_src = gulp.src;
gulp.src = function() {
  return gulp_src.apply(gulp, arguments)
    .pipe(plumber(function(error) {
      // Output an error message
      gutil.log(gutil.colors.red('Error (' + error.plugin + '): ' + error.message));
      // emit the end event, to properly end the task
      this.emit('end');
    })
  );
};
