const path = require('path')
const fs = require('fs')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const rootPath = process.cwd()
const distPath = path.join(rootPath, 'dist')
const srcPath = path.join(rootPath, 'src')
const sceneFilePath = path.join(srcPath, '.expanse.json')
const activeImageTargetBaseName = 'download-1773332030950-2-2'

const makeTsLoader = () => ({
  test: /\.ts$/,
  loader: 'ts-loader',
  exclude: /node_modules/,
})

const config = {
  entry: {
    bundle: path.join(srcPath, 'app.js'),
    'slam-bundle': path.join(srcPath, 'slam.js'),
  },
  output: {
    filename: '[name].js',
    path: distPath,
    publicPath: '/',
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'index.html'),
      filename: 'index.html',
      scriptLoading: 'blocking',
      inject: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'editor.html'),
      filename: 'editor.html',
      scriptLoading: 'blocking',
      inject: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'slam.html'),
      filename: 'slam.html',
      scriptLoading: 'blocking',
      inject: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'review.html'),
      filename: 'review.html',
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
          from: path.join(rootPath, 'image-targets', `${activeImageTargetBaseName}*`),
          to: path.join(distPath, 'image-targets', '[name][ext]'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'citylight.glb'),
          to: path.join(distPath, 'assets', 'citylight.glb'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'miamilow.glb'),
          to: path.join(distPath, 'assets', 'miamilow.glb'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'citysara.glb'),
          to: path.join(distPath, 'assets', 'citysara.glb'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'citysaracomp.glb'),
          to: path.join(distPath, 'assets', 'citysaracomp.glb'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'city-light-blend.glb'),
          to: path.join(distPath, 'assets', 'city-light-blend.glb'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'vendor', 'three-r173-basis'),
          to: path.join(distPath, 'external', 'runtime', 'resources', 'basis'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(srcPath, 'assets', 'common'),
          to: path.join(distPath, 'assets', 'common'),
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
  watchOptions: {
    ignored: [sceneFilePath],
  },
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
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer?.app) {
        return middlewares
      }

      devServer.app.use((req, res, next) => {
        if (req.method !== 'POST' || req.path !== '/__editor/scene') {
          return next()
        }

        let body = ''
        req.setEncoding('utf8')

        req.on('data', (chunk) => {
          body += chunk

          if (body.length > 5 * 1024 * 1024) {
            res.status(413).json({ok: false, error: 'Payload too large'})
            req.destroy()
          }
        })

        req.on('end', () => {
          try {
            req.body = body ? JSON.parse(body) : {}
            next()
          } catch (error) {
            res.status(400).json({ok: false, error: 'Invalid JSON payload'})
          }
        })
      })

      devServer.app.get('/__editor/scene', (_, res) => {
        try {
          const sceneContents = fs.readFileSync(sceneFilePath, 'utf8')
          res.json(JSON.parse(sceneContents))
        } catch (error) {
          res.status(500).json({ok: false, error: 'Could not read scene file'})
        }
      })

      devServer.app.post('/__editor/scene', (req, res) => {
        try {
          const nextScene = req.body

          if (!nextScene || typeof nextScene !== 'object' || !nextScene.objects) {
            res.status(400).json({ok: false, error: 'Scene payload must include objects'})
            return
          }

          fs.writeFileSync(sceneFilePath, `${JSON.stringify(nextScene, null, 2)}\n`, 'utf8')
          res.json({ok: true, updatedAt: new Date().toISOString()})
        } catch (error) {
          res.status(500).json({ok: false, error: 'Could not write scene file'})
        }
      })

      return middlewares
    },
  },
}

module.exports = config
