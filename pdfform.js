(function() {
'use strict';

var fs = require('fs');

global.PDFJS = {};
global.navigator = {
	userAgent: 'pdfform.js',
};
PDFJS.disableStream = true;
PDFJS.disableRange = true;

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

  function serialize(node, refsToVisit, visitedRefs) {
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
	  ret += serialize(node.dict, refsToVisit, visitedRefs);
	  ret += '\nstream\n';
	  var bytes = node.bytes ? node.bytes : node.str.bytes;
	  for (var i = 0; i < bytes.length; i++) {
		ret += String.fromCharCode(bytes[i]);
	  }
	  ret += '\nendstream\n';
	  return ret;
	} else {
	  debugger;
	  throw new Error('Unknown node type. ' + node);
	}
  }

  function createBody(rootRef, refManager, out) {
	var refsToVisit = [rootRef];
	var refSet = new pdf_js.RefSet();
	refSet.put(rootRef);
	while (refsToVisit.length) {
	  var ref = refsToVisit.pop();
	  var obj = refManager.get(ref);
	  refManager.setOffset(ref, out.bytes.length);
	  out.write(ref.num + ' ' + ref.gen + ' obj\n');
	  out.write(serialize(obj, refsToVisit, refSet));
	  out.write('\nendobj\n');
	}
  }

  function createXref(refManager, out) {

	var start = out.bytes.length;

	out.write('xref\n');
	out.write('0 ' + 1 + '\n');
	out.write('0000000000 65535 f\r\n');
	var keys = Object.keys(refManager.offsets).sort(function (a, b) {
	  return a - b;
	});
	for (var i = 0; i < keys.length; i++) {
	  var key = keys[i];
	  // TODO could make these in blocks...
	  out.write(key + ' 1\r\n');
	  out.write(pad(refManager.offsets[key], 10) + ' 00000 n\r\n');
	}
	return start;
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
write_object: function(out, e) {
	e.offset = out.position();
	assert(e.id);
	var bs = serialize(e.obj, [], new pdf_js.RefSet());
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
	this.write_object(out, entry);
},
};

function get_root_id(doc) {
	var obj_id = doc.xref.root.objId;
	var m = /^([0-9]+)R$/.exec(obj_id);
	assert(m, 'root object ID is strange: ' + obj_id);
	return m[1];
}

function transform(data) {
	var doc = new pdf_js.PDFDocument(null, new Uint8Array(data));
	doc.checkHeader();
	doc.parseStartXRef();
	doc.parse();
	var gen = max_gen(doc.xref) + 1;

	var out = new BytesIO();
	out.write_buf(data);

	var objects = new PDFObjects(doc.xref.entries);

	// TODO write new objects

	var startxref = out.position();
	var root_id = get_root_id(doc);
	var root_ref = new pdf_js.Ref(root_id, 0);
	objects.write_xref_stream(out, doc.startXRef, root_ref);

	// write trailer
	/*var trailer_prev = ;
	var root_id = get_root_id(doc);
	out.write_str('trailer\n');
	out.write_str('<<\n');
	out.write_str('/Size ' + objects.next_refnum + '\n');
	out.write_str('/Root ' + root_id + ' 0 R' + '\n');
	out.write_str('/Prev ' + trailer_prev + '\n');
	out.write_str('>>\n');*/

	out.write_str('startxref\n');
	out.write_str(startxref + '\n');
	out.write_str('%%EOF');

	// console.log(doc.xref.entries);
	//console.log(doc.catalog.objId);


/*
	createBody(trailer_ref.ref, refManager, out);
	var xrefOffset = createXref(refManager, out);
	createTrailer(refManager.offsetCount, trailer_ref.ref, xrefOffset, out);*/


	return out.get_buffer();
}

function main() {
	var in_fn = 'Spielberichtsbogen_1BL.pdf';
	// in_fn = 'test.pdf';
	var out_fn = 'out.pdf';
	
	// TODO use proper binary buffers here
	var read = fs.readFileSync(in_fn);
	var res = transform(read);
	fs.writeFileSync(out_fn, res, {encoding: 'binary'});
}

main();
})();
