/* jshint strict: false */

const webpack = require('webpack')

module.exports = {
  entry: './src/ui/entry.js',
  output: {
    path: require('path').resolve('./public'),
    filename: 'app.js',
  },
  module: {
    loaders: [{
      test: /\.hbs/,
      loader: 'handlebars-template-loader',
    }, ],
  },

  externals: {
    jquery: 'jQuery',
  },

  resolve: {
    modulesDirectories: ['node_modules', 'bower_components'],
  },
  plugins: [
    new webpack.ResolverPlugin(
      new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin('.bower.json', ['main'])
    ),
  ],

  node: {
    fs: 'empty', // avoids error messages
  },
}
