const path = require('path');
module.exports = {
  entry: {
    vox: path.resolve(__dirname,'./src/index.js')
  },
  output: {
    libraryTarget: "commonjs",
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  },
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm.js'
    }
  }
};