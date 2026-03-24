const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const rootPath = process.cwd()
const distPath = path.join(rootPath, 'dist')
const srcPath = path.join(rootPath, 'src')

const makeTsLoader = () => ({
  test: /\.ts$/,
  loader: 'ts-loader',
  exclude: /node_modules/,
})

const config = {
  entry: path.join(srcPath, 'app.js'),
  output: {
    filename: 'bundle.js',
    path: distPath,
    publicPath: '/',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'index.html'),
      filename: 'index.html',
      scriptLoading: 'blocking',
      inject: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(rootPath, 'external'),
          to: path.join(distPath, 'external'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'image-targets copy', 'poster2*'),
          to: path.join(distPath, 'image-targets', '[name][ext]'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'city.glb'),
          to: path.join(distPath, 'assets', 'city.glb'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {extensions: ['.ts', '.js']},
  module: {
    rules: [
      makeTsLoader(),
    ],
  },
  mode: 'production',
  context: rootPath,
  devServer: {
    open: false,
    compress: true,
    hot: true,
    liveReload: true,
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
    client: {
      overlay: {
        warnings: false,
        errors: true,
      },
    },
  },
}

module.exports = config
