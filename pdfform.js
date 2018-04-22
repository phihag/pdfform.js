'use strict';

if (typeof window == 'undefined') {
	// node.js, load compat libraries
	var DOMParser = require('xmldom').DOMParser;
	var XMLSerializer = require('xmldom').XMLSerializer;
	var text_encoding = require('text-encoding');
	var TextEncoder = text_encoding.TextEncoder;
	var TextDecoder = text_encoding.TextDecoder;

	var pako = require('pako');
}

function pdfform(minipdf_lib) {

if (minipdf_lib === 'pdf.js') {
	minipdf_lib = require('./minipdf_js.js');
}

if (! minipdf_lib) {
	// autodetct which library to use
	if (typeof minipdf_js != 'undefined') {
		minipdf_lib = minipdf_js;
	} else if (typeof minipdf != 'undefined') {
		minipdf_lib = minipdf;
	} else {
		minipdf_lib = require('./minipdf.js');
	}
}

var assert = minipdf_lib.assert;

function BytesIO() {
	this.length = 0;
	this.entries = [];
}
BytesIO.prototype = {
	write_str: function(s) {
		this.length += s.length;
		assert(typeof s == 'string');
		this.entries.push(s);
	},
	write_buf: function(buf) {
		this.length += buf.length;
		assert(
			buf instanceof Uint8Array,
			'Expected a Uint8Array, but got ' + buf);
		this.entries.push(buf);
	},
	get_uint8array: function() {
		var res = new Uint8Array(this.length);
		var pos = 0;
		this.entries.forEach(function(e) {
			if (typeof e == 'string') {
				for (var i = 0,slen = e.length;i < slen;i++,pos++) {
					res[pos] = e.charCodeAt(i);
				}
			} else {
				res.set(e, pos);
				pos += e.length;
			}
		});
		assert(pos === this.length);
		return res;
	},
	position: function() {
		return this.length;
	},
};


function pad(num, length) {
	var ret = num + '';
	while (ret.length < length) {
		ret = '0' + ret;
	}
	return ret;
}

function serialize_str(str) {
	var ret, i;

	// simple chars, use plaintext
	if (/^[-_/. a-zA-Z0-9]+$/.test(str)) {
		return '(' + str + ')';
	}

	// Only ASCII and some common ANSI chars
	if (/^[\x00-\x7FäöüÄÖÜß]*$/.test(str)) { // eslint-disable-line no-control-regex
		ret = '(';
		for (i = 0; i < str.length; i++) {
			var c = str[i];
			if (c === '\\' || c === '(' || c === ')') {
				ret += '\\';
			}
			ret += c;
		}
		ret += ')';
		return ret;
	}

	// Unicode
	ret = '(';
	ret += '\u00fe\u00ff';
	for (i = 0; i < str.length; i++) {
		var cu = str.charCodeAt(i);
		var c1 = String.fromCharCode(cu >> 8);
		if (c1 === '\\' || c1 === '(' || c1 === ')') {
			ret += '\\';
		}
		ret += c1;
		var c2 = String.fromCharCode(cu & 0xff);
		if (c2 === '\\' || c2 === '(' || c2 === ')') {
			ret += '\\';
		}
		ret += c2;
	}
	ret += ')';
	return ret;
}

function serialize(node, uncompressed) {
	var i, ret;  // Wishing for let in modern browsers :(
	if (minipdf_lib.isRef(node)) {
		return node.num + ' ' + node.gen + ' R';
	} else if (minipdf_lib.isNum(node)) {
		return node;
	} else if (minipdf_lib.isBool(node)) {
		return node;
	} else if (minipdf_lib.isNull(node)) {
		return 'null';
	} else if (minipdf_lib.isName(node)) {
		assert(node.name);
		return '/' + node.name;
	} else if (minipdf_lib.isString(node)) {
		return serialize_str(node);
	} else if (minipdf_lib.isArray(node)) {
		ret = ['['];
		for (i = 0; i < node.length; i++) {
			ret.push(serialize(node[i], uncompressed));
		}
		ret.push(']');
		return ret.join(' ');
	} else if (minipdf_lib.isDict(node)) {
		var map = node.map;
		ret = ['<<'];
		for (var key in map) {
			ret.push('/' + key + ' ' + serialize(map[key], uncompressed));
		}
		ret.push('>>');
		return ret.join('\n');
	} else if (minipdf_lib.isStream(node)) {
		ret = '';
		delete node.dict.map.DecodeParms;
		delete node.dict.map.Filter;

		var content = node.getBytes();
		assert(content, 'expecting byte content from ' + JSON.stringify(node));
		var out;
		if (uncompressed) {
			out = minipdf_lib.buf2str(content);
			node.dict.map.Length = out.length;
		} else {
			out = minipdf_lib.buf2str(pako.deflate(content));
			node.dict.map.Length = out.length;
			node.dict.map.Filter = [new minipdf_lib.Name('FlateDecode')];
		}

		assert(minipdf_lib.isDict(node.dict));
		ret += serialize(node.dict, uncompressed);
		ret += '\nstream\n';
		ret += out;
		ret += '\nendstream\n';
		return ret;
	} else {
		throw new Error('Unknown node type ' + JSON.stringify(node));
	}
  }

function PDFObjects(doc) {
	this.entries = doc.get_xref_entries();
	assert(minipdf_lib.isArray(this.entries), 'xref entries should be an Array');
}
PDFObjects.prototype = {
add: function(obj, gen) {
	var e = {
		obj: obj,
		gen: gen,
		num: this.entries.length,
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
		num: ref.num,
		uncompressed: 'added',
	};
	this.entries[e.num] = e;
	return e;
},
write_object: function(out, e, uncompressed) {
	e.offset = out.position();
	assert(e.num !== undefined);
	var bs = serialize(e.obj, uncompressed);
	out.write_str(e.num + ' ' + e.gen + ' obj\n');
	out.write_str(bs);
	out.write_str('\nendobj\n');
},
write_xref_stream: function(out, prev, root_ref) {
	var map = {
		Type: new minipdf_lib.Name('XRef'),
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
	this.entries.forEach(function(e) {
		assert(e.offset !== undefined, 'entry should have an offset');
		bio.write_buf(new Uint8Array([
			(e.uncompressed ? 1 : 2),
			(e.offset >> 24),
			(e.offset >> 16) & 0xff,
			(e.offset >> 8) & 0xff,
			e.offset & 0xff,
			e.gen,
		]));
	});
	var ui8ar = bio.get_uint8array();

	var stream = minipdf_lib.newStream(map, ui8ar);
	entry.obj = stream;
	this.write_object(out, entry, true);
},
write_xref_table: function(out, prev, root_ref) {
	var entries = this.entries.filter(function(e) {
		return !e.is_free;
	});
	var size = 1 + entries.length;
	out.write_str('xref\n');
	out.write_str('0 ' + size + '\n');
	out.write_str('0000000000 65535 f\r\n');
	entries.forEach(function(e) {
		assert(e.offset !== undefined, 'entry should have an offset');
		out.write_str(pad(e.offset, 10) + ' ' + pad(e.gen, 5) + ' n\r\n');
	});

	// write trailer
	out.write_str('trailer\n');
	var trailer = new minipdf_lib.Dict({
		Size: size,
		Root: root_ref,
	});
	out.write_str(serialize(trailer, true));
},
};

function visit_acroform_fields(doc, callback) {
	if (doc.acroForm) {
		var to_visit = doc.acroForm.map.Fields.slice();
		while (to_visit.length > 0) {
			var n = to_visit.shift();
			if (minipdf_lib.isRef(n)) {
				var ref = n;
				n = doc.fetch(n);
				n._pdfform_ref = ref;
			}

			if (n.map && n.map.Kids) {
				to_visit.push.apply(to_visit, n.map.Kids);
			} else if (n.map && n.map.Type && n.map.Type.name == 'Annot' && n.map.T) {
				callback(n);
			}
		}
	} else {
		// No AcroForm? Look in the pages themselves
		var pages = doc.fetch(doc.root.map.Pages);
		pages.map.Kids.forEach(function(page_ref) {
			var page = doc.fetch(page_ref);
			var annots_ref = page.map.Annots;
			var annots = doc.fetch(annots_ref);

			annots.forEach(function(annot_ref) {
				var n = doc.fetch(annot_ref);
				n._pdfform_ref = annot_ref;
				n._inpage_annot = true;
				if (n.map && n.map.Type && n.map.Type.name == 'Annot' && n.map.T) {
					callback(n);
				}
			});
		});
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
	if (!doc.acroForm) {
		return;
	}
	var xfa = doc.acroForm.map.XFA;
	if (! xfa) {
		return; // acroForm-only
	}
	var section_idx = xfa.indexOf(index);
	assert(section_idx >= 0);
	var section_ref = xfa[section_idx + 1];
	var section_node = doc.fetch(section_ref);
	assert(minipdf_lib.isStream(section_node), 'XFA section node should be a stream');
	var bs = section_node.getBytes();
	assert(bs);
	var prev_str = (new TextDecoder('utf-8')).decode(bs);

	var str = callback(prev_str);
 
	var out_bs = (new TextEncoder('utf-8').encode(str));
	var out_node = minipdf_lib.newStream(section_node.dict.map, out_bs);
	assert(minipdf_lib.isStream(out_node));

	var e = objects.update(section_ref, out_node);
	objects.write_object(out, e);
}

function transform(buf, fields) {
	var doc = minipdf_lib.parse(new Uint8Array(buf));
	var objects = new PDFObjects(doc);
	var root_id = doc.get_root_id();
	var root_ref = new minipdf_lib.Ref(root_id, 0);

	var out = new BytesIO();
	out.write_buf(new Uint8Array(buf));

	// Change AcroForms
	visit_acroform_fields(doc, function(n) {
		var spec = acroform_match_spec(n, fields);
		if (spec === undefined) {
			return;
		}

		var ft_name = n.map.FT.name;
		if (ft_name == 'Tx') {
			n.map.V = '' + spec;
		} else if (ft_name == 'Btn') {
			n.map.AS = n.map.V = n.map.DV = spec ? new minipdf_lib.Name('Yes') : new minipdf_lib.Name('Off');
		} else if (ft_name == 'Ch') {
			n.map.V =  '' + spec;
		} else if (ft_name == 'Sig') {
			return; // Signature fields are not supported so far
		} else {
			throw new Error('Unsupported input type ' + n.map.FT.name);
		}

		var ref = n._pdfform_ref;
		var e = objects.update(ref, n);
		objects.write_object(out, e);
	});

	var acroform_ref = doc.get_acroform_ref();
	if (acroform_ref) { // Acroform present
		doc.acroForm.map.NeedAppearances = true;
		if (minipdf_lib.isRef(acroform_ref)) {
			// Replace just the AcroForm object
			var e = objects.update(acroform_ref, doc.acroForm);
			objects.write_object(out, e);
		} else {
			// Replace the entire root object
			doc.root.map.AcroForm = doc.acroForm;
			var root = objects.update(root_ref, doc.root);
			objects.write_object(out, root);
		}
	}

	// Change XFA
	modify_xfa(doc, objects, out, 'datasets', function(str) {
		// Fix up XML
		str = str.replace(/\n(\/?>)/g, '$1\n');

		var ds_doc = new DOMParser().parseFromString(str, 'application/xml');
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
	if (doc.xref_type === 'table') {
		objects.write_xref_table(out, doc.startXRef, root_ref);
	} else {
		objects.write_xref_stream(out, doc.startXRef, root_ref);
	}

	out.write_str('\nstartxref\n');
	out.write_str(startxref + '\n');
	out.write_str('%%EOF');

	return out.get_uint8array();
}

function list_fields(data) {
	var doc = minipdf_lib.parse(new Uint8Array(data));
	var res = {};

	visit_acroform_fields(doc, function(n) {
		var raw_name = pdf_decode_str(n.map.T);
		var name = raw_name;
		var index = 0;
		var m = /^(.+?)\[([0-9]+)\]$/.exec(raw_name);
		if (m) {
			name = m[1];
			index = parseInt(m[2], 10);
		}

		var spec;
		var ft_name = n.map.FT.name;
		if (ft_name === 'Tx') {
			spec = {type: 'string'};
		} else if (ft_name === 'Btn') {
			spec = {type: 'boolean'};
		} else if (ft_name === 'Ch') {
			spec = {
				type: 'select',
				options: n.map.Opt.slice(),
			};
		} else if (ft_name === 'Sig') {
			return; // Signature names are not supported so far
		} else {
			throw new Error('Unsupported input type' + ft_name);
		}

		if (!res[name]) {
			res[name] = [];
		}
		res[name][index] = spec;
	});

	return res;
}

return {
	transform: transform,
	list_fields: list_fields,
	// test only
	_serialize_str: serialize_str,
	_decode_str: pdf_decode_str,
};
}

// Backwards compatibility only
pdfform.transform = function(buf, fields) {return pdfform().transform(buf, fields);};

if (typeof module != 'undefined') {
	module.exports = pdfform;
}