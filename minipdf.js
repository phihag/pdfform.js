var minipdf = (function() {
'use strict';

var Name = function (name) {
	this.name = name;
};
function isName(obj) {
	return obj instanceof Name;
}
var Dict = function (map) {
	this.map = map;
};
function isDict(obj) {
	return obj instanceof Dict;
}
var Stream = function(map, content) {
	this.map = map;
	this.content = content;
	this.dict = new Dict(map);
};
// pdf.js compatibility
Stream.prototype.getBytes = function() {
	return this.content;
};
function newStream(map, content) {
	assert(content instanceof Uint8Array, 'stream content must be an Uint8Array');
	return new Stream(map, content);
}
function isStream(obj) {
	return obj instanceof Stream;
}
var Ref = function(num, gen) {
	this.num = num;
	this.gen = gen;
};
function isRef(obj) {
	return obj instanceof Ref;
}

function isBool(obj) {
	return typeof obj == 'boolean';
}
function isNull(obj) {
	return obj === null;
}
function isString(obj) {
	return typeof obj == 'string';
}
function isNum(obj) {
	return typeof obj == 'number';
}
function isArray(obj) {
	return obj instanceof Array;
}

function assert(x, msg) {
	if (x) {
		return;
	}
	if (!msg) {
		msg = 'Assertion failed';
	}
	throw new Error(msg);
}

function str2buf(s) {
	var uint = new Uint8Array(s.length);
	for(var i=0,slen=s.length;i < slen;i++){
		uint[i] = s.charCodeAt(i);
	}
	return uint;
}

function png_filter(content, columns) {
	var cols = columns + 1;
	var rows = content.length / cols;
	assert(rows % 1 === 0, 'Invalid column value ' + cols + ' for image width ' + content.length);
	var res = new Uint8Array(columns * rows);
	for (var y = 0;y < rows;y++) {
		var x;
		var filter = content[y * cols];

		if (filter === 0) {
			for (x = 0;x < columns;x++) {
				res[y * columns + x] = content[y * cols + 1 + x];
			}
		} else if (filter === 2) {
			for (x = 0;x < columns;x++) {
				var prev = (y === 0) ? 0 : res[(y - 1) * columns + x];
				res[y * columns + x] = (prev + content[y * cols + 1 + x]) & 0xff;
			}
		} else {
			throw new Error('Unsupported PNG filter ' + filter);
		}
	}
	return res;
}


function _merge_xrefs(xref_table, prev) {
	var len = Math.max(xref_table.length, prev.length);
	for (var i = 1;i < len;i++) {
		if (!prev[i]) {
			continue;
		}
		if (!xref_table[i]) {
			xref_table[i] = prev[i];
		}
	}
}


function inflate(content, params_map) {
	var columns;
	var predictor = 1;
	if (params_map) {
		predictor = params_map.Predictor;
		columns = params_map.Columns;
		if (params_map.Colors) {
			if (params_map.Colors != 1) {
				throw new Error('Unsupported predictor Colors value: ' + params_map.Colors);
			}
		}
		if (params_map.BitsPerComponent) {
			if (params_map.BitsPerComponent != 8) {
				throw new Error('Unsupported predictor BitsPerComponent value: ' + params_map.BitsPerComponent);
			}
		}
	}

	var res = pako.inflate(content);
	if (predictor == 1) {
		return res;
	}

	assert(columns > 0, 'columns must be set for PNG predictors');

	if ((predictor >= 10) && (predictor <= 15)) {
		res = png_filter(res, columns);
	} else {
		throw new Error('Unsupported predictor ' + predictor);
	}
	return res;
}

function parse(buf) {
	return new PDFDocument(buf);
}

var PDFDocument = function(buf) {
	this._cached_object_streams = {};

	this.buf = buf;
	this.reader = new PDFReader(buf);

	check_header(buf);
	this.startXRef = find_startxref(buf);
	this.reader.pos = this.startXRef;

	var xref_res = this.reader.parse_xref();
	this.xref = xref_res.xref;
	assert(isArray(this.xref));
	this.meta = xref_res.meta;
	assert(this.meta.Root, 'meta.Root missing');
	assert(isRef(this.meta.Root), 'meta.root should be Ref');

	this.root = this.fetch(this.meta.Root);
	this.xref_type = this.reader.xref_type;

	var af_node = this.get_acroform_ref();
	if (isRef(af_node)) {
		this.acroForm = this.fetch(af_node);
	} else {
		this.acroForm = af_node;
	}
};
PDFDocument.prototype.get_root_id = function() {
	return this.meta.Root.num;
};
PDFDocument.prototype.get_xref_entries = function() {
	return this.xref;
};
PDFDocument.prototype.get_acroform_ref = function() {
	return this.root.map.AcroForm;
};
PDFDocument.prototype.fetch = function(ref, recursive) {
	assert(ref instanceof Ref);

	var xref_entry = this.xref[ref.num];
	if (! xref_entry) {
		throw new Error('Cannot find object ' + ref.num + ' in xref table');
	}
	if (xref_entry.type === 0) {
		throw new Error('Cannot fetch a free object');
	}
	if (xref_entry.type == 2) {
		if (recursive) {
			throw new Error('Cannot fetch object stream inside object stream');
		}
		if (ref.gen !== 0) {
			throw new Error('Object with reference ' + ref.gen + ' cannot be found in object stream');
		}
		var object_stream = this._cached_object_streams[xref_entry.offset];
		if (! object_stream) {
			var object_stream_obj = this.fetch(new Ref(xref_entry.offset, 0), true);
			object_stream = parse_object_stream(object_stream_obj);
			this._cached_object_streams[xref_entry.offset] = object_stream;
		}
		if (! (ref.num in object_stream)) {
			throw new Error(
				'Could not find object ' + ref.num +
				' in object stream with entries ' + JSON.stringify(Object.keys(object_stream)));
		}
		var res = object_stream[ref.num];
		return res;
	}
	if (ref.gen != xref_entry.gen) {
		throw new Error('Invalid generation: Asked for ' + ref.gen + ', table has ' + xref_entry.gen);
	}
	this.reader.pos = xref_entry.offset;

	var obj = this.reader.parse_object();
	if (obj.num !== ref.num) {
		throw new Error('Expected to read object with ID ' + ref.num + ', but found ' + obj.num);
	}
	if (obj.gen !== ref.gen) {
		throw new Error('Expected to read object with gen ' + ref.gen + ', but found ' + obj.gen);
	}
	return obj.obj;
};

var PDFReader = function(buf) {
	assert(buf instanceof Uint8Array, 'Expected a buffer of type Uint8Array');
	assert(buf.BYTES_PER_ELEMENT === 1, 'not a Uint8Array!');
	this.buf = buf;
	this.pos = 0;
};
PDFReader.prototype = {
	skip_space: function() {
		while (this.pos < this.buf.length) {
			var c = this.buf[this.pos];
			if ((c == 9) || (c == 10) || (c == 13) || (c == 32)) {
				this.pos++;
			} else {
				break;
			}
		}
	},
	skip_start: function(str) {
		if (startswith(this.buf, this.pos, str)) {
			this.pos += str.length;
			return true;
		}
		return false;
	},
	read_uint: function(len) {
		var res = 0;
		while(len > 0) {
			assert(this.buf[this.pos] !== undefined, 'reading uint at position ' + this.pos + ' of ' + this.buf.length);
			res = (res << 8 | (this.buf[this.pos] & 0xff)) >>> 0;
			this.pos++;
			len--;
		}
		return res;
	},
	parse_string: function() {
		var res = '';
		var parens = 1;
		while (this.pos < this.buf.length) {
			var c = String.fromCharCode(this.buf[this.pos]);
			this.pos++;
			if (c == ')') {
				parens--;
				if (parens === 0) {
					break;
				}
				res += c;
			} else if (c == '(') {
				parens++;
				res += c;
			} else if (c == '\\') {
				c = String.fromCharCode(this.buf[this.pos]);
				this.pos++;
				switch(c) {
				case 'n':
					res += '\n';
					break;
				case 'r':
					res += '\r';
					break;
				case 't':
					res += '\t';
					break;
				case '\r':
				case '\n':
					break;
				case '\\':
				case '(':
				case ')':
					res += c;
					break;
				default:
					throw new Error('Unsupported escape "' + c + '"');
				}
			} else {
				res += c;
			}
		}
		return res;
	},
	parse_hex_string: function() {
		var start_pos = this.pos;
		while (this.pos < this.buf.length) {
			if (this.buf[this.pos] == '>'.charCodeAt(0)) {
				break;
			}
			this.pos++;
		}
		var hex_str = buf2str(this.buf, start_pos, this.pos);
		this.pos++;
		if ((hex_str.length % 2) == 1) {
			hex_str += '0';
		}
		if (!/^[0-9A-Fa-f]*$/.test(hex_str)) {
			throw new Error('Invalid hex string ' + hex_str);
		}
		return hex_str.replace(/([0-9A-Fa-f]{2})/g, function() {
			return String.fromCharCode(parseInt(arguments[1], 16));
		});
	},
	parse_num: function() {
		var res = 0;
		var first_pos = this.pos;
		while (this.pos < this.buf.length) {
			var by = this.buf[this.pos];
			if ((48 <= by) && (by <= 57)) {
				res = res * 10 + by - 48;
			} else {
				break;
			}
			this.pos++;
		}
		if (first_pos === this.pos) {
			throw new Error('Not an ASCII number byte: ' + this.buf[this.pos]);
		}
		return res;
	},
	parse_name: function() {
		var start_pos = this.pos;
		var DELIM_CHARS = [0, 9, 13, 10, 32, 40, 41, 60, 62, 91, 93, 123, 125, 47, 37];
		while (this.pos < this.buf.length) {
			if (DELIM_CHARS.indexOf(this.buf[this.pos]) >= 0) {
				break;
			}
			this.pos++;
		}
		var name = buf2str(this.buf, start_pos, this.pos);
		name = name.replace(/#([0-9a-fA-F]{2})/g, function(_, hex) {
			return String.fromCharCode(parseInt(hex, 16));
		});
		return new Name(name);
	},
	parse_array: function() {
		var res = [];
		for (;;) {
			this.skip_space();
			if (this.buf[this.pos] == 93) { // ]
				break;
			}
			var el = this.parse();
			res.push(el);
		}
		this.pos++;
		return res;
	},
	parse_dict: function() {
		var map = {};
		while (this.pos < this.buf.length) {
			this.skip_space();
			if (this.skip_start('>>')) {
				break;
			}
			if (!this.skip_start('/')) {
				throw new Error('Key is not a name in dict');
			}
			var k = this.parse_name();
			var v = this.parse();
			map[k.name] = v;
		}
		var sav_pos = this.pos;
		this.skip_space();
		if (this.skip_start('stream\r\n') || this.skip_start('stream\n') || this.skip_start('stream')) {
			return this.parse_stream_content(map);
		} else {
			this.pos = sav_pos;
			return new Dict(map);
		}
	},
	parse_stream_content: function(map) {
		if (typeof map.Length != 'number') {
			throw new Error('Stream Length field missing or invalid: ' + JSON.stringify(map.Length));
		}
		if (this.pos + map.Length > this.buf.length) {
			throw new Error('Stream Length too large');
		}
		var content = this.buf.subarray(this.pos, this.pos + map.Length);
		this.pos += map.Length;
		this.skip_space();
		if (!this.skip_start('endstream')) {
			throw new Error('Missing endstream');
		}
		if (map.Filter) {
			var filters = (map.Filter instanceof Array) ? map.Filter : [map.Filter];
			var params = (map.DecodeParms instanceof Array) ? map.DecodeParms : [map.DecodeParms];
			for (var i = 0;i < filters.length;i++) {
				var filter_params = params[i];

				switch (filters[i].name) {
				case 'FlateDecode':
					content = inflate(content, filter_params ? filter_params.map : filter_params);
					break;
				default:
					throw new Error('Unsupported filter: ' + JSON.stringify(filters[i].name));
				}
			}
		}

		return new Stream(map, content);
	},
	parse: function() {
		this.skip_space();
		if (this.skip_start('<<')) {
			return this.parse_dict();
		}
		if (this.skip_start('[')) {
			return this.parse_array();
		}
		if (this.skip_start('(')) {
			return this.parse_string();
		}
		if (this.skip_start('<')) {
			return this.parse_hex_string();
		}
		if (this.skip_start('/')) {
			return this.parse_name();
		}
		
		if (this.skip_start('true')) {
			return true;
		}
		if (this.skip_start('false')) {
			return false;
		}
		if (this.skip_start('null')) {
			return null;
		}

		var s = buf2str(this.buf, this.pos, this.pos+32);
		var m = /^([0-9]+)\s+([0-9]+)\s+R/.exec(s);
		if (m) {
			this.pos += m[0].length;
			return new Ref(parseInt(m[1], 10), parseInt(m[2], 10));
		}
		m = /^[+-]?(?:[0-9]*\.[0-9]*|[0-9]+)/.exec(s);
		if (m) {
			this.pos += m[0].length;
			return parseFloat(m[0]);
		}

		throw new Error('Unable to parse ' + buf2str(this.buf, this.pos, this.pos + 40));
	},
	parse_xref: function() {
		var i;
		if (startswith(this.buf, this.pos, 'xref')) {
			// Textual xref table;
			this.xref_type = 'table';
			return this.parse_xref_table();
		}
		this.xref_type = 'stream';
		var obj = this.parse_object().obj;
		var xref = [];

		if ('Prev' in obj.map) {
			var sav_pos = this.pos;
			this.pos = obj.map.Prev;
			xref = this.parse_xref().xref;
			this.pos = sav_pos;
		}

		assert(
			obj instanceof Stream,
			'XRefs should be a stream, got ' + JSON.stringify(obj) + ' instead');
		assert(
			obj.map.Type.name === 'XRef',
			'XRef table should be of Type XRef');
		assert(obj.map.W.length == 3);
		var type_length = obj.map.W[0];
		assert(type_length <= 4);
		var offset_length = obj.map.W[1];
		assert((offset_length >= 1) && (offset_length <= 4));
		var gen_length = obj.map.W[2];
		assert((gen_length >= 1) && (gen_length <= 4));
		assert(
			obj.content.length % (type_length + offset_length + gen_length) === 0,
			'content is ' + obj.content.length + ' bytes long, each entry is ' + JSON.stringify(obj.map.W));

		var total_count = obj.content.length / (type_length + offset_length + gen_length);
		var index = obj.map.Index;
		if (index) {
			var aggregate_count = 0;
			for (i = 0;i < index.length;i += 2) {
				assert(typeof index[i] == 'number');
				assert(typeof index[i + 1] == 'number');
				aggregate_count += index[i + 1];
			}
			assert(
				aggregate_count == total_count,
				'Invalid xref stream index: index says ' + aggregate_count + ' objects, but space for ' + total_count);
		} else {
			index = [0, total_count];
		}

		var reader = new PDFReader(obj.content);
		for (var index_i = 0;index_i < index.length;index_i += 2) {
			var first_index = index[index_i];
			var count = index[index_i + 1];

			for (i = 0;i < count;i++) {
				var type = 1;
				if (type_length) {
					type = reader.read_uint(type_length);
				}
				var offset = reader.read_uint(offset_length);
				var gen = reader.read_uint(gen_length);
				var xr_dict = {
					type: type,
					offset: offset,
					gen: gen,
				};
				if (type === 0) {
					xr_dict.free = true;
				} else {
					xr_dict.uncompressed = type != 2;
				}
				xref[first_index + i] = xr_dict;
			}
		}
		assert(reader.at_eof());

		return {
			meta: obj.map,
			xref: xref,
		};
	},
	parse_object: function() {
		var s = buf2str(this.buf, this.pos, this.pos+32);
		var m = /^([0-9]+)\s+([0-9]+)\s+obj/.exec(s);
		if (!m) {
			throw new Error('Missing object ID: ' + s);
		}
		var real_num = parseInt(m[1], 10);
		var real_gen = parseInt(m[2], 10);
		this.pos += m[0].length;
		var obj = this.parse();
		this.skip_space();
		if (!this.skip_start('endobj')) {
			throw new Error('endobj missing, current str: ' + JSON.stringify(buf2str(this.buf, this.pos, this.pos+32)));
		}
		return {
			obj: obj,
			num: real_num,
			gen: real_gen,
		};
	},
	parse_xref_table: function() {
		if (!this.skip_start('xref')) {
			throw new Error('xref table does not start with xref!');
		}
		this.skip_space();
		var start_num = this.parse_num();
		var xref = [];
		for (var j = 0;j < start_num;j++) {
			xref.push(undefined);
		}
		this.skip_space();
		this.parse_num();  // count. Sometimes this is just a lie though, so ignore it
		for (;;) {
			this.skip_space();
			if (this.skip_start('trailer')) {
				break;
			}
			var offset = this.parse_num();
			this.skip_space();
			var gen = this.parse_num();
			this.skip_space();
			var usage = this.buf[this.pos];
			if ((usage == 102) || (usage == 110)) { // n and f
				this.pos++;
			} else {
				// no usage character: this means we need to skip
				while (xref.length < offset) {
					xref.push(undefined);
				}
				continue;
			}
			xref.push({
				offset: offset,
				gen: gen,
				is_free: (usage === 102),
			});
		}

		var meta = this.parse();
		if (meta.map.Prev) {
			this.pos = meta.map.Prev;
			var old = this.parse_xref_table();
			_merge_xrefs(xref, old.xref);
		}

		return {
			xref: xref,
			meta: meta.map,
		};
	},
	at_eof: function() {
		return this.pos == this.buf.length;
	},
};

function startswith(buf, pos, str) {
	for (var i = 0;i < str.length;i++) {
		if (str.charCodeAt(i) != buf[pos + i]) {
			return false;
		}
	}
	return true;
}

function buf2str(buf, from, to) {
	if (from === undefined) {
		from = 0;
	}
	if (to === undefined) {
		to = buf.length;
	}
	var max = Math.min(to, buf.length);

	var res = '';
	for (var i = from;i < max;i++) {
		res += String.fromCharCode(buf[i]);
	}
	return res;
}


function check_header(buf) {
	if (! startswith(buf, 0, '%PDF-')) {
		throw new Error('Does not look like a PDF file!');
	}
}

function find_startxref(buf) {
	var s = buf2str(buf, buf.length - 40,buf.length);
	var m = /startxref\s*([0-9]+)/.exec(s);
	if (!m) {
		throw new Error('Cannot find startxref!');
	}
	return parseInt(m[1]);
}

function parse_object_stream(os_obj) {
	assert(
		os_obj.map.Type.name === 'ObjStm',
		'Strange Type for an object stream: ' + JSON.stringify(os_obj.map.Type.name));
	var s = buf2str(os_obj.content, 0, os_obj.map.First);
	var rex = /\s*([0-9]+)\s+([0-9]+)/g;
	var res = [];
	var r = new PDFReader(os_obj.content);
	for (var i = 0;i < os_obj.map.N;i++) {
		var m = rex.exec(s);
		if (! m) {
			throw new Error('Expected ' + os_obj.map.N + ' objects in this object stream, failed to read number ' + i);
		}
		var num = parseInt(m[1], 10);
		var offset = parseInt(m[2], 10);
		r.pos = offset + os_obj.map.First;
		res[num] = r.parse();
	}

	return res;
}

return {
	parse: parse,
	PDFDocument: PDFDocument,
	isName: isName,
	isStream: isStream,
	isDict: isDict,
	isRef: isRef,
	isNum: isNum,
	isArray: isArray,
	isString: isString,
	isBool: isBool,
	isNull: isNull,
	newStream: newStream,
	assert: assert,
	buf2str: buf2str,
	str2buf: str2buf,

	// Testing only
	PDFReader: PDFReader,
	Name: Name,
	Dict: Dict,
	Ref: Ref,
	Stream: Stream,
};

})();

if ((typeof module != 'undefined') && (typeof require != 'undefined')) {
	var pako = require('pako');
	module.exports = minipdf;
}
