(function() {
'use strict';

var fs = require('fs');
var DOMParser = require('xmldom').DOMParser;
var XMLSerializer = require('xmldom').XMLSerializer;
var text_encoding = require('text-encoding');
var TextEncoder = text_encoding.TextEncoder;
var TextDecoder = text_encoding.TextDecoder;



global.PDFJS = {};
global.navigator = {
	userAgent: 'pdfform.js',
};
PDFJS.disableStream = true;
PDFJS.disableRange = true;
var pdf_js = require('./customlibs/pdf.worker.js');
assert(!pdf_js.parse);
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



var pako = require('./libs/pako.min.js');
var minipdf = require('./minipdf.js');


function adler32_buf(buf) {
	var a = 1;
	var b = 0;
	var MOD = 65521;

	for (var i = 0;i < buf.length;i++) {
		a = (a + buf[i]) % MOD;
		b = (b + a) % MOD;
    }
    return ((b << 16) | a) >>> 0; // >>> 0 forces the result to be interpreted as unsigned int
}

function BytesIO() {
	this.length = 0;
	this.buffers = [];
}
BytesIO.prototype = {
	write_str: function(s) {
		this.length += s.length;
		this.buffers.push(new Buffer(s, 'binary'));
	},
	write_buf: function(buf) {
		this.length += buf.length;
		this.buffers.push(buf);
	},
	get_buffer: function() {
		return Buffer.concat(this.buffers);
	},
	get_uint8array: function() {
		return new Uint8Array(this.get_buffer());
	},
	position: function() {
		return this.length;
	},
};

function assert(x, msg) {
	if (x) {
		return;
	}
	if (!msg) {
		msg = 'Assertion failed';
	}
	throw new Error(msg);
}

function buf2str(buf) {
	var res = '';
	for (var i = 0; i < buf.length; i++) {
		res += String.fromCharCode(buf[i]);
	}
	return res;
}



// Code from pdf.utils.js (ASL2) starts here

function pad(num, length) {
  var ret = num + '';
  while (ret.length < length) {
	ret = '0' + ret;
  }
  return ret;
}

function hasSpecialChar(str) {
  for (var i = 0, ii = str.length; i < ii; i++) {
	switch (str[i]) {
	case '(':
	case ')':
	case '\\':
	case '\n':
	case '\r':
	case '\t':
	case '\b':
	case '\f':
		return true;
	}
  }
  return false;
}


function serialize(node, uncompressed) {
	var i, ret;  // Wishing for let in modern browsers :(
	if (pdf_js.isRef(node)) {
		return node.num + ' ' + node.gen + ' R';
	} else if (pdf_js.isNum(node)) {
		return node;
	} else if (pdf_js.isBool(node)) {
		return node;
	} else if (pdf_js.isName(node)) {
		return '/' + node.name;
	} else if (pdf_js.isString(node)) {
		if (!hasSpecialChar(node)) {
		return '(' + node + ')';
		} else {
		ret = '<';
		for (i = 0; i < node.length; i++) {
			ret += pad(node.charCodeAt(i).toString(16), 2);
		}
		return ret + '>';
		}
	} else if (pdf_js.isArray(node)) {
		ret = ['['];
		for (i = 0; i < node.length; i++) {
			ret.push(serialize(node[i], uncompressed));
		}
		ret.push(']');
		return ret.join(' ');
	} else if (pdf_js.isDict(node)) {
		var map = node.map;
		ret = ['<<'];
		for (var key in map) {
			ret.push('/' + key + ' ' + serialize(map[key], uncompressed));
		}
		ret.push('>>');
		return ret.join('\n');
	} else if (pdf_js.isStream(node)) {
		ret = '';
		delete node.dict.map.DecodeParms;
		delete node.dict.map.Filter;

		var content = node.getBytes();
		assert(content);
		var out;
		if (uncompressed) {
			out = buf2str(content);
			node.dict.map.Length = out.length;
		} else {
			out = buf2str(pako.deflate(content));
			node.dict.map.Length = out.length;
			node.dict.map.Filter = [new pdf_js.Name('FlateDecode')];
		}

		assert(pdf_js.isDict(node.dict));
		ret += serialize(node.dict, uncompressed);
		ret += '\nstream\n';
		ret += out;
		ret += '\nendstream\n';
		return ret;
	} else {
		throw new Error('Unknown node type ' + JSON.stringify(node));
	}
  }

// End of code from pdf.utils.js

function PDFObjects(xref) {
	this.entries = xref.entries;
}
PDFObjects.prototype = {
add: function(obj, gen) {
	var e = {
		obj: obj,
		gen: gen,
		id: this.entries.length,
		uncompressed: 'added',
	};
	this.entries.push(e);
	return e;
},
update: function(ref, obj) {
	assert(ref.num !== undefined);
	assert(ref.gen !== undefined);
	var e = {
		obj: obj,
		gen: ref.gen,
		id: ref.num,
		uncompressed: 'added',
	};
	this.entries[e.id] = e;
	return e;
},
write_object: function(out, e, uncompressed) {
	e.offset = out.position();
	assert(e.id !== undefined);
	var bs = serialize(e.obj, uncompressed);
	out.write_str(e.id + ' ' + e.gen + ' obj\n');
	out.write_str(bs);
	out.write_str('\nendobj\n');
},
write_xref_stream: function(out, prev, root_ref) {
	var map = {
		Type: new pdf_js.Name('XRef'),
		Size: this.entries.length + 1, // + 1 for this object itself
		Length: 6 * (this.entries.length + 1),
		Root: root_ref,
		W: [1, 4, 1],
	};
	if (prev !== undefined) {
		map.Prev = prev;
	}

	var bio = new BytesIO();
	var entry = this.add('__xref_stream__', 0);
	entry.offset = out.position();
	this.entries.forEach(function(e, i) {
		assert(e.offset !== undefined, 'entry should have an offset');
		bio.write_buf(new Buffer([
			(e.uncompressed ? 1 : 2),
			(e.offset >> 24),
			(e.offset >> 16) & 0xff,
			(e.offset >> 8) & 0xff,
			e.offset & 0xff,
			e.gen,
		]));
	});
	var ui8ar = bio.get_uint8array();

	var stream = pdf_js.newStream(map, ui8ar);
	entry.obj = stream;
	this.write_object(out, entry, true);
},
};

function visit_acroform_fields(doc, callback) {
	var to_visit = doc.acroForm.map.Fields.slice();
	while (to_visit.length > 0) {
		var n = to_visit.shift();
		if (pdf_js.isRef(n)) {
			var ref = n;
			n = doc.xref.fetch(n);
			n._pdfform_ref = ref;
		}

		if (n.map && n.map.Kids) {
			to_visit.push.apply(to_visit, n.map.Kids);
		} else if (n.map && n.map.Type && n.map.Type.name == 'Annot') {
			callback(n);
		}
	}
}

function pdf_decode_str(str) {
	if (! str.startsWith('\u00FE\u00FF')) {
		return str;
	}
    var res = '';
	for (var i = 2; i < str.length; i += 2) {
		res += String.fromCharCode(str.charCodeAt(i) << 8 | str.charCodeAt(i + 1));
	}
	return res;
}

function acroform_match_spec(n, fields) {
	var t = pdf_decode_str(n.map.T);
	if (t in fields) {
		return fields[t][0];
	} else {
		var m = /^(.*)\[([0-9]+)\]$/.exec(t);
		if (m && (m[1] in fields)) {
			return fields[m[1]][m[2]];
		}
	}
	return undefined;
}

function modify_xfa(doc, objects, out, index, callback) {
	var xfa = doc.acroForm.map.XFA;
	var section_idx = xfa.indexOf(index);
	assert(section_idx >= 0);
	var section_ref = xfa[section_idx + 1];
	var section_node = doc.xref.fetch(section_ref);
	assert(pdf_js.isStream(section_node), 'XFA section node should be a stream');
	var bs = section_node.getBytes();
	assert(bs);
	var str = (new TextDecoder('utf-8')).decode(bs);

	str = callback(str);
 
	var out_bs = (new TextEncoder('utf-8').encode(str));
	var out_node = pdf_js.newStream(section_node.dict.map, out_bs);
	assert(pdf_js.isStream(out_node));

	var e = objects.update(section_ref, out_node);
	objects.write_object(out, e);
}

function transform(data, fields) {
	var doc = pdf_js.parse(new Uint8Array(data));

	var out = new BytesIO();
	out.write_buf(data);

	var objects = new PDFObjects(doc.xref);

	// Change AcroForms
	visit_acroform_fields(doc, function(n) {
		var spec = acroform_match_spec(n, fields);
		if (spec === undefined) {
			return;
		}

		if (n.map.FT.name == 'Tx') {
			n.map.V = '' + spec;
		} else if (n.map.FT.name == 'Btn') {
			n.map.AS = n.map.V = n.map.DV = spec ? new pdf_js.Name('Yes') : new pdf_js.Name('Off');
		} else {
			throw new Error('Unsupported input type' + n.map.FT.name);
		}

		var ref = n._pdfform_ref;
		var e = objects.update(ref, n);
		objects.write_object(out, e);
	});
	// Set NeedAppearances in AcroForm dict
	var acroform_ref = doc.catalog.catDict.map.AcroForm;
	doc.acroForm.map['NeedAppearances'] = true;
	var e = objects.update(acroform_ref, doc.acroForm);
	objects.write_object(out, e);


	// Change XFA
	modify_xfa(doc, objects, out, 'datasets', function(str) {
		// Fix up XML
		str = str.replace(/\n(\/?>)/g, '$1\n');

		var ds_doc = new DOMParser().parseFromString(str);
		for (var f in fields) {
			var els = ds_doc.getElementsByTagName(f);

			for (var i = 0;i < els.length;i++) {
				var val = fields[f][i];
				if (val === undefined) {
					continue;
				}
				var el = els[i];
				while (el.firstChild) {
					el.removeChild(el.firstChild);
				}

				if (typeof val == 'boolean') {
					val = val ? 1 : 0;
				}
				el.appendChild(ds_doc.createTextNode(val));
			}
		}

		str = new XMLSerializer().serializeToString(ds_doc);
		return str;
	});

	var startxref = out.position();
	var root_id = doc.get_root_id();
	var root_ref = new pdf_js.Ref(root_id, 0);
	objects.write_xref_stream(out, doc.startXRef, root_ref);

	out.write_str('startxref\n');
	out.write_str(startxref + '\n');
	out.write_str('%%EOF');

	return out.get_buffer();
}

function main() {
	var in_fn = 'Spielberichtsbogen_2BL.pdf';
	var out_fn = 'out.pdf';
	
	var read = fs.readFileSync(in_fn);
	var fields = {
		'NumerischesFeld1': [
			1,
			2,
			3,
			4,
			5,
			6,
		],
		'NumerischesFeld2': [
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
			5, 6, 7, 8, 9, 10, 1, 2,
		],
		'Textfeld1': ['EIns'],
		'Textfeld2': ['zwei'],
		'Textfeld3': ['drei'],
		'Textfeld4': ['vier'],
		'Textfeld5': ['fünf'],
		'Textfeld6': ['sechserlei'],
		'Textfeld7': ['sieben'],
		'Textfeld8': ['acht'],
		'Textfeld9': ['a91', '92', 'foobar93', '94', '95', '96', '97', '98', 'more', 'content', 'all', 'around the the world with really long'],
		'Textfeld10': ['zehn-1', 'zehn2', 'zehn-3', 'zehn-4', 'zehn-5', 'zehn-6', 'zehn-7', 'zehn-8', 'zehn-9'],
		'Textfeld11': ['elfß'],
		'Textfeld12': ['zölfe'],
		'Textfeld13': ['dreizehn'],
		'Kontrollkästchen1': [true],
		'#field[91]': [true],
		'Optionsfeldliste': [true, true, true],
	};
	var res = transform(read, fields);
	fs.writeFileSync(out_fn, res, {encoding: 'binary'});
}

main();
})();
