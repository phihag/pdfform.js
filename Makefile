default: help

help:
	@echo 'make targets:'
	@echo '  deps          Download and install all dependencies (for compiling / testing / CLI operation)'
	@echo '  test          Run tests'
	@echo '  lint          Verify source code quality'
	@echo '  clean         Remove temporary files'
	@echo '  help          This message'


install-libs:
	test -e libs/.completed || $(MAKE) force-install-libs

force-install-libs:
	mkdir -p libs
	#wget https://raw.githubusercontent.com/mozilla/pdfjs-dist/master/build/pdf.combined.js -O libs/pdf.combined.js
	wget https://raw.githubusercontent.com/chick307/adler32cs.js/master/adler32cs.js -O libs/adler32cs.js
	#wget https://raw.githubusercontent.com/MrRio/jsPDF/master/libs/deflate.js -O libs/deflate.js

	touch libs/.completed

deps: install-libs
	(node --version && npm --version) >/dev/null 2>/dev/null || sudo apt-get install nodejs npm
	npm install

test:
	@npm test

lint: jshint eslint

jshint:
	@jshint js/*.js div/*.js test/*.js div/*.js cachesw.js

eslint:
	@eslint js/*.js div/*.js test/*.js div/*.js cachesw.js

coverage:
	istanbul cover _mocha -- -R spec

coverage-display: coverage
	xdg-open coverage/lcov-report/js/index.html

cd: coverage-display

clean:
	rm -rf -- libs
	rm -rf -- node_modules

.PHONY: default help deps test clean install-libs force-install-libs dist cleandist coverage coverage-display cd lint jshint eslint
