const path = require('path');
module.exports = {
  entry: {
    index: path.resolve(__dirname,'./example/index.js')
  },
  output: {
    filename: '[name].js',      // 打包后的文件名称
    path: path.resolve(__dirname,'./example/dist')  // 打包后的目录
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      },
    ]
  },
};