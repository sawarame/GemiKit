const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    content: './src/content.ts',
    options: './src/options.ts'
  },
  output: {
    path: path.resolve(__dirname, 'package/js'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  devtool: 'source-map'
};
