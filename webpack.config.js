const path = require("path");

module.exports = {
  mode: "production",
  devtool: false,
  entry: "./index.js",
  output: {
    filename: "pdfform.dist.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
    libraryExport: "default",
    library: "pdfform",
  },
  externals: {
    xmldom: "xmldom",
    "text-encoding": "text-encoding",
    "./minipdf_js.js": "minipdf_lib",
  },
};
