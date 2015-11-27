var pdf_js = (function() {
'use strict';

function assert(x, msg) {
	if (x) {
		return;
	}
	if (!msg) {
		msg = 'Assertion failed';
	}
	throw new Error(msg);
}

global.PDFJS = {};
global.navigator = {
	userAgent: 'pdfform.js',
};
PDFJS.disableStream = true;
PDFJS.disableRange = true;
var pdf_js = require('./customlibs/pdf.worker.js');
assert(!pdf_js.parse);
pdf_js.assert = assert;
pdf_js.parse = function(buf) {
	var doc = new pdf_js.PDFDocument(null, buf);
	doc.checkHeader();
	doc.parseStartXRef();
	doc.parse();
	doc.get_root_id = function() {
		var obj_id = this.catalog.catDict.objId;
		var m = /^([0-9]+)R$/.exec(obj_id);
		assert(m);
		return parseInt(m[1], 10);
	};
	doc.fetch = function(ref) {
		return this.xref.fetch(ref);
	};
	doc.get_acroform_ref = function() {
		return this.catalog.catDict.map.AcroForm;
	};
	doc.get_xref_entries = function() {
		return this.xref.entries;
	};
	return doc;
};
pdf_js.newDict = function(map) {
	var dict = new pdf_js.Dict();
	dict.map = map;
	return dict;
};
pdf_js.newStream = function(map, buf) {
	var dict = pdf_js.newDict(map);
	return new pdf_js.Stream(buf, 0, buf.length, dict);
};
pdf_js.buf2str = function(buf) {
	var res = '';
	for (var i = 0; i < buf.length; i++) {
		res += String.fromCharCode(buf[i]);
	}
	return res;
};


return pdf_js;
})();

if (typeof module != 'undefined') {
	module.exports = pdf_js;
}