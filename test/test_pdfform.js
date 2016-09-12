'use strict';

var assert = require('assert');
var fs = require('fs');

var pdfform = require('../pdfform.js');

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
				'DruckenSchaltfläche1': ['boolean'],
				'ZurücksetzenSchaltfläche1': ['boolean'],
				'EMailSendenSchaltfläche1': ['boolean'],
				'Kontrollkästchen1': ['boolean'],
				'NumerischesFeld1': repeat('string', 8),
				'NumerischesFeld2': repeat('string', 54),
				'Optionsfeldliste': repeat('boolean', 3),
				'Textfeld1': ['string'],
				'Textfeld2': ['string'],
				'Textfeld3': ['string'],
				'Textfeld4': ['string'],
				'Textfeld5': ['string'],
				'Textfeld6': ['string'],
				'Textfeld7': ['string'],
				'Textfeld8': ['string'],
				'Textfeld9': repeat('string', 16),
				'Textfeld10': repeat('string', 24),
				'Textfeld11': ['string'],
				'Textfeld12': ['string'],
				'Textfeld13': ['string'],
				'Textfeld14': repeat('string', 5),
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
				'Hello World_4SEXUsSJ-VWn6n1APNranw': ['string'],
				'fc-int01-generateAppearances': ['string'],
			});

			var res = pdfform().transform(contents, {
				'Hello World_4SEXUsSJ-VWn6n1APNranw': ['hi!'],
			});
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

});
