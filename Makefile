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
	touch libs/.completed

deps: install-libs
	(node --version && npm --version) >/dev/null 2>/dev/null || sudo apt-get install nodejs npm
	npm install

lint: eslint

eslint:
	@eslint test/*.js *.js

clean_dist:
	rm -rf -- dist

test:
	@npm test

dist: clean_dist
	mkdir -p dist
	uglifyjs libs/pako.min.js minipdf.js pdfform.js -o dist/pdfform.dist.js

clean: clean_dist
	rm -rf -- node_modules
	rm -rf -- libs

.PHONY: default help deps lint eslint clean dist clean_dist test install-libs force-install-libs
