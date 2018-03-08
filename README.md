# pdfform.js

Fill out PDF forms in pure JavaScript, both in the browser or on the server.

pdfform.js can function with a slightly customized version of [pdf.js](https://github.com/mozilla/pdf.js). However, due to the size and scope of PDF.js (1600KB+), by default a built-in PDF library (called minipdf) is used.

The [online demo](https://phihag.github.io/pdfform.js/docs/demo.html) demonstrates *both* (not recommended in actual production).

## Installation

To use in a browser, download and serve either [pdfform.minipdf.dist.js](https://raw.githubusercontent.com/phihag/pdfform.js/dist/dist/pdfform.minipdf.dist.js) (minipdf, recommended) or [pdfform.pdf_js.dist.js](https://raw.githubusercontent.com/phihag/pdfform.js/dist/dist/pdfform.pdf_js.dist.js) (pdf.js).

Alternatively, download/clone this repository and add `minipdf.js` and `pdfform.js` to your JavaScript files. You'll also need the [pako](https://github.com/nodeca/pako) library.

## Usage

Simply call `transform` with the PDF file contents and the fields.

```html
<!-- download from https://raw.githubusercontent.com/phihag/pdfform.js/dist/dist/pdfform.minipdf.dist.js -->
<script src="downloaded/pdfform.minipdf.dist.js"></script>
<script>
var pdf_buf = ...; // load PDF into an ArrayBuffer, for example via XHR (see demo)
var fields = {
    'fieldname': ['value for fieldname[0]', 'value for fieldname[1]'],
};
var out_buf = pdfform().transform(pdf_buf, fields);
// Do something with the resulting PDF file in out_buf
</script>
```

There is also a `list_fields` function which allows you to list all available fields and their types.

For more details, have a look at the [demo](https://phihag.github.io/pdfform.js/docs/demo.html) and its [JavaScript code](https://github.com/phihag/pdfform.js/blob/master/docs/demo.js).