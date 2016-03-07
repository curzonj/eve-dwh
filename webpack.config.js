/* jshint strict: false */

module.exports = {
  entry:  './src/ui',
  output: {
    path:     require('path').resolve('./public'),
    filename: 'app.js',
  },
  module: {
    loaders: [
      { test: /\.hbs/, loader: 'handlebars-template-loader' },
    ],
  },

  node: {
    fs: 'empty', // avoids error messages
  },
}
