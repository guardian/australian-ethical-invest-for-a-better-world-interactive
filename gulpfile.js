const config = require('./config.json')

const autoprefixer = require('gulp-autoprefixer')
const browserSync = require('browser-sync')
const concat = require('gulp-concat')
const del = require('del')
const file = require('gulp-file')
const gulp = require('gulp')
const htmlmin = require('gulp-htmlmin')
const nunjucks = require('gulp-nunjucks')
const plumber = require('gulp-plumber')
const rename = require('gulp-rename')
const runSequence = require('run-sequence')
const s3Upload = require('gulp-s3-upload')
const sass = require('gulp-sass')
const sassVars = require('gulp-sass-vars')
const sourcemaps = require('gulp-sourcemaps')
const surge = require('gulp-surge')
const uglify = require('gulp-uglify')

let domain = null
let path = null
let project = null
let version = null
let cdn = null

if (process.env.NODE_ENV === 'production') {
  domain = 'https://interactive.guim.co.uk'
  path = 'atoms'
  project = config.path
  version = `v/${Date.now()}`
  cdn = `${domain}/${path}/${project}/${version}/`
}

gulp.task('browser-sync', () =>
  browserSync.init({
    server: {
      baseDir: 'dest',
      index: 'main.html'
    }
  })
)

gulp.task('build', callback =>
  runSequence('clean', ['images', 'scripts', 'stylesheets', 'templates'], callback)
)

gulp.task('clean', () =>
  del('dest')
)

gulp.task('default', ['build', 'watch'])

function s3(cacheControl, keyPrefix) {
  return s3Upload()({
    'Bucket': 'gdn-cdn',
    'ACL': 'public-read',
    'CacheControl': cacheControl,
    'keyTransform': fn => `${keyPrefix}/${fn}`
  })
}

gulp.task('deploy', ['build'], () =>
  gulp.src('dest/**/*')
    .pipe(s3('max-age=31536000', `${path}/${project}/${version}`))
    .on('end', () =>
      gulp.src('config.json')
        .pipe(file('preview', version))
        .pipe(file('live', version))
        .pipe(s3('max-age=30', `${path}/${project}`))
    )
)

gulp.task('images', () =>
  gulp.src('src/images/*')
    .pipe(gulp.dest('dest/images'))
)

gulp.task('scripts', () =>
  gulp.src([
    'node_modules/when-in-viewport/dist/whenInViewport.js',
    'src/scripts/main.js'
  ])
    .pipe(plumber())
    .pipe(sourcemaps.init())
      .pipe(concat('main.js'))
      .pipe(uglify())
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dest'))
    .on('end', browserSync.reload)
)

gulp.task('stage', ['build'], () =>
  surge({
    project: 'dest',
    domain: 'australian-ethical-invest-for-a-better-world.surge.sh'
  })
)

gulp.task('stylesheets', () => {
  const variables = {
    cdn: cdn
  }

  gulp.src('src/stylesheets/*.scss')
    .pipe(plumber())
    .pipe(sourcemaps.init())
      .pipe(sassVars(variables, {
        verbose: true
      }))
      .pipe(sass({
        outputStyle: 'compressed',
        precision: 10
      }))
      .pipe(autoprefixer())
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dest'))
    .pipe(browserSync.stream({
      match: '**/*.css'
    }))
  }
)

gulp.task('templates', () =>
  gulp.src('src/templates/*.njk')
    .pipe(plumber())
    .pipe(nunjucks.compile({
      cdn: cdn
    }))
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true
    }))
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest('dest'))
    .on('end', browserSync.reload)
)

gulp.task('url', () =>
  console.log('\nAtom URL: https://internal.content.guardianapis.com/atom/interactive/interactives/' + project + '\n')
)

gulp.task('watch', ['browser-sync'], () => {
  gulp.watch('src/images/*', ['images'])
  gulp.watch('src/scripts/**/*.js', ['scripts'])
  gulp.watch('src/stylesheets/**/*.scss', ['stylesheets'])
  gulp.watch('src/templates/**/*.njk', ['templates'])
})
