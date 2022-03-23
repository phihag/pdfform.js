#@mollie/pdfform



### This fork is a combination of timetotrade/pdfform.js and phiphag/pdfform.js

#### This code only works in browsers and not on node servers as the node implementation relied on libraries that broke browser functionality

Fill out PDF forms in pure JavaScript in the browser.

pdfform.js can function with a slightly customized version of [pdf.js](https://github.com/mozilla/pdf.js). However, due to the size and scope of PDF.js (1600KB+), by default a built-in PDF library (called minipdf) is used.

The [online demo](https://phihag.github.io/pdfform.js/docs/demo.html) demonstrates _both_ (not recommended in actual production).

## Installation

Pdfform.js includes libraries which are used only for testing and excluded from production builds. Production builds of pdfform.js have a single dependancy - [Pako](https://www.npmjs.com/package/pako) - which is bundled into the output script.

Use `yarn build` to generate a production build and serve `dist/pdfform.dist.js`.


## Usage

Simply call `transform` with the PDF file contents and the fields.

```html
<script src="assets/scripts/pdfform.dist.js"></script>
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
