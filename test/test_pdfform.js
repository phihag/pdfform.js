'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pdfform = require('../pdfform.js');

function repeat(val, len) {
	var res = [];
	while (len--) {
		res.push(val);
	}
	return res;
}

describe ('pdfform', function() {
	it('example conversion', function(done) {
		var in_fn = __dirname + '/data/Spielberichtsbogen_2BL.pdf';
		var out_fn = __dirname + '/data/out.pdf';

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

		fs.readFile(in_fn, function(err, in_buf) {
			if (err) {
				return done(err);
			}
			var res = pdfform().transform(in_buf, fields);
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

	it('list fields', function(done) {
		var in_fn = __dirname + '/data/Spielberichtsbogen_2BL.pdf';
		fs.readFile(in_fn, function(err, contents) {
			if (err) {
				return done(err);
			}
			var fields = pdfform().list_fields(contents);

			assert.deepStrictEqual(fields, {
				'DruckenSchaltfläche1': [{type: 'boolean'}],
				'ZurücksetzenSchaltfläche1': [{type: 'boolean'}],
				'EMailSendenSchaltfläche1': [{type: 'boolean'}],
				'Kontrollkästchen1': [{type: 'boolean'}],
				'NumerischesFeld1': repeat({type: 'string'}, 8),
				'NumerischesFeld2': repeat({type: 'string'}, 54),
				'Optionsfeldliste': repeat({type: 'boolean'}, 3),
				'Textfeld1': [{type: 'string'}],
				'Textfeld2': [{type: 'string'}],
				'Textfeld3': [{type: 'string'}],
				'Textfeld4': [{type: 'string'}],
				'Textfeld5': [{type: 'string'}],
				'Textfeld6': [{type: 'string'}],
				'Textfeld7': [{type: 'string'}],
				'Textfeld8': [{type: 'string'}],
				'Textfeld9': repeat({type: 'string'}, 16),
				'Textfeld10': repeat({type: 'string'}, 24),
				'Textfeld11': [{type: 'string'}],
				'Textfeld12': [{type: 'string'}],
				'Textfeld13': [{type: 'string'}],
				'Textfeld14': repeat({type: 'string'}, 5),
			});
			done();
		});
	});

	it('flooie-example-form', function(done) {
		var in_fn = __dirname + '/data/New Form 9_11_16.pdf';
		var out_fn = __dirname + '/data/out-flooie.pdf';
		fs.readFile(in_fn, function(err, contents) {
			if (err) {
				return done(err);
			}
			var fields = pdfform().list_fields(contents);

			assert.deepStrictEqual(fields, {
				'Hello World_4SEXUsSJ-VWn6n1APNranw': [{type: 'string'}],
				'fc-int01-generateAppearances': [{type: 'string'}],
			});

			var res = pdfform().transform(contents, {
				'Hello World_4SEXUsSJ-VWn6n1APNranw': ['hi!'],
			});
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

	it('flooie-cjd100-doc', function(done) {
		var in_fn = __dirname + '/data/CJ-D 100 Complaint for Annulment.pdf';
		var out_fn = __dirname + '/data/out-flooie-cjd100.pdf';
		fs.readFile(in_fn, function(err, contents) {
			if (err) {
				return done(err);
			}
			var fields = pdfform().list_fields(contents, true);

			assert.deepStrictEqual(fields, {
				'form1[0].BodyPage1[0].DropDownList1': [
					{
						'type': 'select',
						'options': [
							'  ',
							'Barnstable',
							'Berkshire',
							'Bristol',
							'Dukes',
							'Essex',
							'Franklin',
							'Hampden',
							'Hampshire',
							'Middlesex',
							'Nantucket',
							'Norfolk',
							'Plymouth',
							'Suffolk',
							'Worcester',
						],
					},
				],
				'form1[0].BodyPage1[0].TextField1': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].BodyPage1[0].TextField2': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].BodyPage1[0].RadioButtonList': [
					{
						'type': 'boolean',
					},
				],
				'form1[0].BodyPage1[0].TextField4': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].BodyPage1[0].CheckBox1': [
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
				],
				'form1[0].BodyPage1[0].Sub2[0].Multi2': [
					{
						'type': 'string',
					},
				],
				'form1[0].BodyPage1[0].Sub1[0].Multi1': [
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].DropDownList1': [
					{
						'type': 'select',
						'options': [
							'  ',
							'Barnstable',
							'Berkshire',
							'Bristol',
							'Dukes',
							'Essex',
							'Franklin',
							'Hampden',
							'Hampshire',
							'Middlesex',
							'Nantucket',
							'Norfolk',
							'Plymouth',
							'Suffolk',
							'Worcester',
						],
					},
				],
				'form1[0].#subform[1].TextField1': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].TextField2': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].TextField4': [
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].CheckBox1': [
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
				],
				'form1[0].#subform[1].RadioButtonList': [
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
					{
						'type': 'boolean',
					},
				],
				'form1[0].#subform[1].DateTimeField1': [
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].TextField5': [
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].TextField7': [
					{
						'type': 'string',
					},
				],
				'form1[0].#subform[1].TextField6': [
					{
						'type': 'string',
					},
				],
			});

			var res = pdfform().transform(contents, {
				'form1[0].BodyPage1[0].DropDownList1': ['Middlesex'],
				'form1[0].BodyPage1[0].TextField1': ['foo', 'bar'],
			});
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

	it('special characters (≤) in text', (done) => {
		const in_fn = path.join(__dirname, 'data', 'simple.pdf');
		const out_fn = path.join(__dirname, 'data', 'out-simple.pdf');
		fs.readFile(in_fn, (err, contents) => {
			if (err) return done(err);
			const fields = pdfform().list_fields(contents);
			assert.deepStrictEqual(fields, {
				textbox1: [{type: 'string'}],
			});

			const res = pdfform().transform(contents, {
				'textbox1': ['a≤b'],
			});

			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

	it('serialize_str', () => {
		const serialize_str = pdfform()._serialize_str;
		assert.strictEqual(serialize_str('abc def9'), '(abc def9)');
		assert.strictEqual(serialize_str('(a a'), '(\\(a a)');
		assert.strictEqual(serialize_str('ä'), '(ä)');
		assert.strictEqual(serialize_str('≤'), '(\xfe\xff"d)');
		assert.strictEqual(serialize_str('a≤'), '(\xfe\xff\x00a"d)');
		assert.strictEqual(serialize_str('a ≤ b ä'), '(\xfe\xff\x00a\x00 "d\x00 \x00b\x00 \x00\xe4)');
	});

	it('SkySoft PDF editor with radio and signature (with pdf.js)', function(done) {
		const in_fn = __dirname + '/data/skysoft-example.pdf';
		const out_fn = __dirname + '/data/skysoft.out.pdf';

		fs.readFile(in_fn, function(err, in_buf) {
			if (err) {
				return done(err);
			}

			const pdfjs_wrap = require('../minipdf_js.js');

			const fields = pdfform(pdfjs_wrap).list_fields(in_buf);
			assert.deepStrictEqual(fields, {
				'MasterCard': [
					{'type': 'boolean'},
				],
				'Visa': [
					{'type': 'boolean'},
				],
			});

			const values = {
				'MasterCard': [[true]],
				'Visa': [[true]],
			};

			const res = pdfform(pdfjs_wrap).transform(in_buf, values);
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

});
