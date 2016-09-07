var fs = require('fs');

(function() {
'use strict';

var pdfform = require('../pdfform.js');

describe ('pdfform', function() {
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
});

})();
