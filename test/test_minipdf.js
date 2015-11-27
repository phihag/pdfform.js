var assert = require('assert');
var fs = require('fs');

(function() {
'use strict';

var minipdf = require('../minipdf');

function assert_parse(s, expected) {
	var buf = str2uint8ar(s + '   more');
	var r = new minipdf.PDFReader(buf);
	var got = r.parse();
	assert.deepEqual(got, expected);
	assert.deepStrictEqual(got, expected);
	assert.strictEqual(r.pos, s.length);
}

function assert_parse_name(s, expected) {
	var buf = str2uint8ar(s);
	var r = new minipdf.PDFReader(buf);
	var res = r.parse();
	assert.ok(res instanceof minipdf.Name);
	assert.equal(res.name, expected);
}

function str2uint8ar(s) {
	var res = new Uint8Array(s.length);
	for (var i = 0; i < s.length; i++) {
		res[i] = s.charCodeAt(i);
	}
	return res;
}


describe('minipdf parsing', function() {
	it('boolean parsing', function() {
		assert_parse(' true', true);
		assert_parse('false', false);
	});

	it('number parsing', function() {
		assert_parse('1', 1);
		assert_parse('-1', -1);
		assert_parse('97261', 97261);
		assert_parse('123', 123);
		assert_parse('43445', 43445);
		assert_parse('+17', 17);
		assert_parse('-98', -98);
		assert_parse('0', 0);

		assert_parse('34.5', 34.5);
		assert_parse('-3.62', -3.62);
		assert_parse('+123.6', 123.6);
		assert_parse('-.002', -0.002);
		assert_parse('0.0', 0.0);
	});

	it('string parsing', function() {
		assert_parse('(This is a string)', 'This is a string');
		assert_parse(
			'(Strings may contain newlines\nand such.)',
			'Strings may contain newlines\nand such.');
		assert_parse(
			'(Strings may contain balanced parentheses ( ) and\nspecial characters ( * ! & } ^ % and so on ).)',
			'Strings may contain balanced parentheses ( ) and\nspecial characters ( * ! & } ^ % and so on ).');
		assert_parse('()', '');
		assert_parse('(new\\\nline)', 'newline');
		assert_parse(
			'(escapes: \\n, \\r, \\t, \\(, \\) backslash: \\\\)',
			'escapes: \n, \r, \t, (, ) backslash: \\');

		assert_parse('<abcd757465>', '\xab\xcdute');
		assert_parse('<4e756c6c627974653a207>', 'Nullbyte: p');
	});

	it('name parsing', function() {
		assert_parse_name(' /Name1 2', 'Name1');
		assert_parse_name('/ASomewhatLongerName 32', 'ASomewhatLongerName');
		assert_parse_name('/A;Name_With-Various***Characters?', 'A;Name_With-Various***Characters?');
		assert_parse_name('/1.2', '1.2');
		assert_parse_name('/', '');
		assert_parse_name('/ ', '');
		assert_parse_name('/$$', '$$');
		assert_parse_name('/@pattern', '@pattern');
		assert_parse_name('/.notdef', '.notdef');
		assert_parse_name('/paired#28#29parentheses', 'paired()parentheses');
	});

	it('array parsing', function() {
		assert_parse('[ 549 3.14 false (Ralph) /SomeName ]', [
			549,
			3.14,
			false,
			'Ralph',
			new minipdf.Name('SomeName'),
		]);
		assert_parse('[ 12 34 56 R (x)]', [
			12,
			new minipdf.Ref(34, 56),
			'x',
		]);
		assert_parse('[ 12 34 [(nested) (in) (here )] 43]', [
			12, 34, ['nested', 'in', 'here '], 43,
		]);
		assert_parse('[  ]', []);
	});

	it('dict parsing', function() {
		assert_parse(
			'<< /Type /Example /Subtype /DictionaryExample\n/Version 0.01\n/IntegerItem 12\n' +
			'/StringItem (a string)/Subdictionary << /Item1 0.4 ' +
			'/Item2 true\n' +
			'/LastItem (not !)\n' +
			'/VeryLastItem (OK)>> /a (b) >>',
			new minipdf.Dict({
				Type: new minipdf.Name('Example'),
				Subtype: new minipdf.Name('DictionaryExample'),
				Version: 0.01,
				IntegerItem: 12,
				StringItem: 'a string',
				Subdictionary: (new minipdf.Dict({
					Item1: 0.4,
					Item2: true,
					LastItem: 'not !',
					VeryLastItem: 'OK',
				})),
				a: 'b',
			})
		);
	});

	it('ref parsing', function() {
		assert_parse('123 456 R', new minipdf.Ref(123, 456));
	});

	it('simple stream parsing', function() {
		assert_parse(
			'<< /Length 12>>stream123456789abcendstream',
			new minipdf.Stream({Length: 12}, str2uint8ar('123456789abc')));
		assert_parse(
			'<< /Length 12>>\nstream\r\n123456789abc\n endstream',
			new minipdf.Stream({Length: 12}, str2uint8ar('123456789abc')));
		assert_parse(
			'<< /Length 12>> stream\n123456789abc\n endstream',
			new minipdf.Stream({Length: 12}, str2uint8ar('123456789abc')));
	});

	it('parse XRef Stream', function() {
		var s = (
			'1 0 obj<< /Root 12 0 R /Length 10 /Type /XRef /Size 2 /W [1 2 2]>>stream' +
			'\x01\x02\x03\x04\x05\x02\x07\x08\x09\x0aendstreamendobj');
		var buf = str2uint8ar(s);
		var r = new minipdf.PDFReader(buf);
		var res = r.parse_xref();
		assert.deepStrictEqual(res.meta, {
			Root: (new minipdf.Ref(12, 0)),
			Length: 10,
			Type: (new minipdf.Name('XRef')),
			Size: 2,
			W: [1, 2, 2],
		});
		assert.deepStrictEqual(res.xref, [
			{type: 1, offset: 0x203, gen: 0x405, uncompressed: true},
			{type: 2, offset: 0x708, gen: 0x90a, uncompressed: false},
		]);
	});

	it('parse XRef Stream with Prev', function() {
		// TODO call it parse_all_xref
	});

	it('flate stream parsing', function() {
		// TODO add a test
	});

	it('object stream parsing', function() {
		// TODO add a test
	});

	it('read_int', function() {
		var buf = new Uint8Array([0x22, 0x15, 0x19, 0xff, 0x12, 0x99, 0xab]);
		var r = new minipdf.PDFReader(buf);
		assert.strictEqual(r.read_uint(1), 0x22);
		assert.strictEqual(r.read_uint(2), 0x1519);
		assert.strictEqual(r.read_uint(4), 0xff1299ab);
	});

	it('a real file', function() {
		var buf;
		try {
			buf = fs.readFileSync(__dirname + '/../Spielberichtsbogen_2BL.pdf');
		} catch(e) {
			if (e.code == 'ENOENT') {
				return;
			} else {
				throw e;
			}
		}
		var doc = new minipdf.PDFDocument(buf);
		assert.deepStrictEqual(doc.root.map.Type, new minipdf.Name('Catalog'));
		assert(doc.acroForm);
		assert(doc.acroForm.map.XFA);
	});
});

})();