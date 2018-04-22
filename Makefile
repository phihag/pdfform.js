default: help

help:
	@echo 'make targets:'
	@echo '  deps          Download and install all dependencies (for compiling / testing / CLI operation)'
	@echo '  test          Run tests'
	@echo '  lint          Verify source code quality'
	@echo '  clean         Remove temporary files'
	@echo '  dist          Produce distributable file (dist branch only)'
	@echo '  help          This message'

install-libs:
	test -e libs/.completed || $(MAKE) force-install-libs

force-install-libs:
	mkdir -p libs
	wget https://raw.githubusercontent.com/nodeca/pako/master/dist/pako.min.js -O libs/pako.min.js
	#wget https://github.com/mozilla/pdf.js/releases/download/v1.4.20/pdfjs-1.4.20-dist.zip -O libs/pdfjs.dist.zip
	#unzip -x -o -j -d libs/ libs/pdfjs.dist.zip build/pdf.js
	touch libs/.completed

deps: install-libs
	(node --version && npm --version) >/dev/null 2>/dev/null || sudo apt-get install nodejs npm
	npm install

lint: eslint

eslint:
	@node_modules/.bin/eslint test/*.js docs/*.js *.js

clean_dist:
	rm -rf -- dist

test:
	@npm test

dist: clean_dist
	mkdir -p dist
	node_modules/.bin/uglifyjs -b ascii_only=true,beautify=false libs/pako.min.js minipdf.js pdfform.js -o dist/pdfform.minipdf.dist.js
	node_modules/.bin/uglifyjs -b ascii_only=true,beautify=false libs/pako.min.js customlibs/pdf.worker.js minipdf_js.js pdfform.js -o dist/pdfform.pdf_js.dist.js

clean: clean_dist
	rm -rf -- node_modules
	rm -rf -- libs

.PHONY: default help deps lint eslint clean dist clean_dist test install-libs force-install-libs
