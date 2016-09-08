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
	it('breaking okular', function(done) {
		// Generated via demo
		var fields = {"DruckenSchaltfläche1":[true],"EMailSendenSchaltfläche1":[true],"Optionsfeldliste":[true,true,true],"Textfeld1":["1"],"Textfeld2":["2"],"Textfeld3":["3"],"Textfeld4":["4"],"Textfeld5":["5"],"Textfeld6":["6"],"Textfeld7":["7"],"Textfeld8":["8"],"NumerischesFeld1":["9","10","11","12","13","14","15","16"],"Textfeld9":["17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32"],"Textfeld10":["33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56"],"NumerischesFeld2":["57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95","96","97","98","99","100","101","102","103","104","105","106","107","108","109","110"],"Textfeld11":["111"],"Textfeld12":["112"],"Textfeld13":["113"],"Textfeld14":["114","115","116","117","118"],"ZurücksetzenSchaltfläche1":[true],"Kontrollkästchen1":[true]};
		var in_fn = __dirname + '/data/Spielberichtsbogen_2BL.pdf';
		var out_fn = __dirname + '/data/okular-breakage.pdf';
		fs.readFile(in_fn, function(err, in_buf) {
			if (err) return done(err);
			var res = pdfform.transform(in_buf, fields);
			fs.writeFile(out_fn, new Buffer(res), {encoding: 'binary'}, done);
		});
	});

	it('example conversion', function() {
		var in_fn = __dirname + '/data/Spielberichtsbogen_2BL.pdf';
		var out_fn = __dirname + '/data/out.pdf';

		var in_buf = fs.readFileSync(in_fn);

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
		var res = pdfform.transform(in_buf, fields);
		fs.writeFileSync(out_fn, new Buffer(res), {encoding: 'binary'});
	});

	it('list fields', function(done) {
		var in_fn = __dirname + '/data/Spielberichtsbogen_2BL.pdf';
		fs.readFile(in_fn, function(err, contents) {
			if (err) {
				return done(err);
			}
			var fields = pdfform.list_fields(contents);

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
});
