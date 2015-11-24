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



var adler32cs = require('./libs/adler32cs.js');
var Deflater = require('./libs/deflate.js').Deflater;
var pdf_js = require('./libs/pdf.worker.js');

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
		// TODO remove this debugging code
		var real_len = Buffer.concat(this.buffers).length;
		assert(this.length == real_len);
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

function str2uint8ar(s) {
	var res = new Uint8Array(s.length);
	for (var i = 0; i < s.length; i++) {
		res[i] = s.charCodeAt(i);
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


function RefManager(xref) {
	// Hack so we don't have any refs collide.
	this.id = xref.entries.length;
	this.map = {};
	this.offsets = {};
	this.offsetCount = 0;
	this.xref = xref;
}
RefManager.prototype = {
	create: function (obj) {
	  var ref = new pdf_js.Ref(this.id++, 0);
	  var str = ('R' + ref.num + '.' + ref.gen);
	  var wrapper = {
		ref: ref,
		obj: obj
	  };
	  this.map[str] = wrapper;
	  return wrapper;
	},
	get: function (ref) {
	  var str = ('R' + ref.num + '.' + ref.gen);
	  var obj;
	  if (str in this.map) {
		obj = this.map[str].obj;
	  } else {
		obj = this.xref.fetch(ref);
	  }
	  return obj;
	},
	setOffset: function (ref, offset) {
	  this.offsets[ref.num] = offset;
	  this.offsetCount++;
	}
}



  function DictModel() {
	this.map = {};
  }

  function serialize(node, refsToVisit, visitedRefs, uncompressed) {
	if (pdf_js.isRef(node)) {
	  if (!visitedRefs.has(node)) {
		visitedRefs.put(node);
		refsToVisit.unshift(node);
	  }
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
		var ret = '<';
		for (var i = 0; i < node.length; i++) {
		  ret += pad(node.charCodeAt(i).toString(16), 2);
		}
		return ret + '>';
	  }
	} else if (pdf_js.isArray(node)) {
	  var ret = ['['];
	  for (var i = 0; i < node.length; i++) {
		ret.push(serialize(node[i], refsToVisit, visitedRefs));
	  }
	  ret.push(']');
	  return ret.join(' ');
	} else if (pdf_js.isDict(node)) {
	  var map = node.map;
	  var ret = ['<<'];
	  for (var key in map) {
		ret.push('/' + key + ' ' + serialize(map[key], refsToVisit, visitedRefs));
	  }
	  ret.push('>>');
	  return ret.join('\n');
	} else if (pdf_js.isStream(node)) {
		var ret = '';
		// TODO instead of deleting the metadata here set up a filter
		delete node.dict.map.DecodeParms;
		delete node.dict.map.Filter;

		var bytes = node.bytes ? node.bytes : node.str.bytes;

		var out;
		if (uncompressed) {
			out = buf2str(bytes);
			node.dict.map.Length = out.length;
		} else {
			var p = buf2str(bytes);
			var arr = [];
			var i = p.length;
			while(i--) {
				arr[i] = p.charCodeAt(i);
			}
			var adler32 = adler32cs.from(p);
			var deflater = new Deflater(6);
			deflater.append(new Uint8Array(arr));
			var p = deflater.flush();
			var arr = new Uint8Array(p.length + 6);
			arr.set(new Uint8Array([120, 156])),
			arr.set(p, 2);
			arr.set(new Uint8Array([adler32 & 0xFF, (adler32 >> 8) & 0xFF, (adler32 >> 16) & 0xFF, (adler32 >> 24) & 0xFF]), p.length+2);
			p = String.fromCharCode.apply(null, arr);
			out = p;
			node.dict.map.Length = out.length;
			node.dict.map.Filter = [new pdf_js.Name('FlateDecode')];
		}

	  ret += serialize(node.dict, refsToVisit, visitedRefs);
	  ret += '\nstream\n';
	  ret += out;
	  ret += '\nendstream\n';
	  return ret;
	} else {
	  debugger;
	  throw new Error('Unknown node type. ' + node);
	}
  }

  function newDict(map) {
	var dict = new pdf_js.Dict();
	dict.map = map;
	return dict;
  }

  function newStream(map, str) {
	var dict = newDict(map);
	var data = new Uint8Array(str.length);
	for (var i = 0; i < str.length; i++) {
	  data[i] = str.charCodeAt(i);
	}
	var stream = new pdf_js.Stream(data, 0, str.length, dict);
	return stream;
  }





// End of code from pdf.utils.js


function max_gen(xref) {
	var max = 0;
	for (var i = 0;i < xref.entries.length;i++) {
		var e = xref.entries[i];
		if ((e.gen != 65535) && (e.gen > max)) {
			max = e.gen;
		}
	}
	return max;
}


function PDFObjects(entries) {
	this.entries = entries;
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
update: function(id, obj, gen) {
	var e = {
		obj: obj,
		gen: gen,
		id: id,
		uncompressed: 'added',
	};
	this.entries[id] = e;
	return e;
},
write_object: function(out, e, uncompressed) {
	e.offset = out.position();
	assert(e.id);
	var bs = serialize(e.obj, [], new pdf_js.RefSet(), uncompressed);
	out.write_str(e.id + ' ' + e.gen + ' obj\n');
	out.write_str(bs);
	out.write_str('\nendobj\n');
},
gen_xref: function() {
	var bio = new BytesIO();
		bio.write_str('xref\n');
	bio.write_str('0 1\n');
	bio.write_str('0000000000 65535 f\r\n');

	this.entries.forEach(function(e) {
		assert(e.offset, e + 'should have an offset set');
		bio.write_str(e.id + ' 1\n');
		bio.write_str(pad(e.offset, 10) + ' ' + pad(e.gen, 5) + ' n\r\n');
	});

	// write trailer
	/*var trailer_prev = ;
	var root_id = get_root_id(doc);
	out.write_str('trailer\n');
	out.write_str('<<\n');
	out.write_str('/Size ' + objects.next_refnum + '\n');
	out.write_str('/Root ' + root_id + ' 0 R' + '\n');
	out.write_str('/Prev ' + trailer_prev + '\n');
	out.write_str('>>\n');*/

	return bio.get_buffer();
},
write_xref_stream: function(out, prev, root_ref) {
	var dict = {
		Type: new pdf_js.Name('XRef'),
		Size: this.entries.length + 1, // + 1 for this object itself
		Length: 6 * (this.entries.length + 1),
		Root: root_ref,
		W: [1, 4, 1],
	};
	if (prev !== undefined) {
		dict['Prev'] = prev;
	}
	var dict_obj = newDict(dict);

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

	var stream = new pdf_js.Stream(ui8ar, 0, ui8ar.length, dict_obj);
	entry.obj = stream;
	this.write_object(out, entry, true);
},
};

function get_root_id(doc) {
	return get_node_id(doc.xref.root);
}

function get_node_id(node) {
	var obj_id = node.objId;
	var m = /^([0-9]+)R$/.exec(obj_id);
	assert(m, 'node object ID is strange: ' + obj_id);
	return m[1];
}

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
			n.map.Kids.forEach(function(k) {
				to_visit.push(k);
			});
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
	var xfa_idx = xfa.indexOf(index);
	var xfa_ref = xfa[xfa_idx + 1];
	var xfa_node = doc.xref.fetch(xfa_ref);
	var bs = xfa_node.getBytes();
	var str = (new TextDecoder('utf-8')).decode(bs);

	str = callback(str);
 
	var out_bs = (new TextEncoder('utf-8').encode(str));
	fs.writeFileSync(index, str);
	xfa_node.bytes = out_bs;
	xfa_node.length = out_bs.length;
	
	var e = objects.update(xfa_ref.num, xfa_node, xfa_ref.gen);
	objects.write_object(out, e);
}

function transform(data, fields) {
	var doc = new pdf_js.PDFDocument(null, new Uint8Array(data));
	doc.checkHeader();
	doc.parseStartXRef();
	doc.parse();

	var out = new BytesIO();
	out.write_buf(data);

	var objects = new PDFObjects(doc.xref.entries);

	// Change AcroForms
/*	visit_acroform_fields(doc, function(n) {
		var spec = acroform_match_spec(n, fields);
		if (spec === undefined) {
			return;
		}

		if (n.map.FT.name == 'Tx') {
			n.map.V = n.map.DV = '' + spec;
		} else if (n.map.FT.name == 'Btn') {
			n.map.AS = n.map.V = n.map.DV = spec ? new pdf_js.Name('Yes') : new pdf_js.Name('Off');
		} else {
			throw new Error('Unsupported input type' + n.map.FT.name);
		}

		var ref = n._pdfform_ref;
		var e = objects.update(ref.num, n, ref.gen);
		objects.write_object(out, e);
	});
*/
	// Change XFA
	modify_xfa(doc, objects, out, 'template', function(str) {
		// Manually check checkboxes (this is for bup only)
		str = str.replace(
			/(<value\s*><integer\s*>)0(<\/integer)/g,
			function (_, g1, g2) {
				return g1 + '1' + g2;
			}
		);

		return str;
	});
	modify_xfa(doc, objects, out, 'datasets', function(str) {
		// Fix up XML
		str = str.replace(/\n(\/?>)/g, '$1\n')

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
		// str = str.replace(/(<\/[0-9a-zA-Z]+)>\s+</g, '$1\n><')
		return str;
	});

	var startxref = out.position();
	var root_id = get_root_id(doc);
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
