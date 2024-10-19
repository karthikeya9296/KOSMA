const path = require('path');

module.exports = {
  entry: './frontend/src/index.js', // Starting point of your application
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'bundle.js', // Output file name
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Transpile JavaScript files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'], // Ensure compatibility with modern JavaScript and React
          },
        },
      },
      {
        test: /\.scss$/, // Handle SCSS files
        use: [
          'style-loader', // Injects styles into DOM
          'css-loader', // Resolves CSS imports
          'sass-loader', // Compiles SCSS to CSS
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/, // Handle image files
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]', // Keep original file names
              outputPath: 'images/', // Output directory for images
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/, // Handle font files
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/', // Output directory for fonts
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'], // Resolve these file types automatically
  },
  devServer: {
    static: path.join(__dirname, 'public'), // Serve static files from the 'public' folder
    compress: true, // Enable compression for faster load times
    port: 3000, // Port for the development server
    open: true, // Open browser on server start
    hot: true, // Enable hot module replacement
  },
};
