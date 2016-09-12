// Example of constructing pdfform
// If you don't care about which PDF library to use, just call without arguments, as in
// pdfform().transform(..) / pdfform().list_fields(...)
function make_pdfform() {
	var lib_name = document.querySelector('input[name="pdflib"]:checked').value;
	return pdfform((lib_name === 'minipdf') ? minipdf : minipdf_js);
}

// Example of listing all fields
function list(buf) {
	var list_form = document.querySelector('.list_form');
	empty(list_form);

	var cnt = 1;
	var field_specs;
	try {
		field_specs = make_pdfform().list_fields(buf);
	} catch (e) {
		on_error(e);
		return;
	}
	for (var field_key in field_specs) {
		var row = document.createElement('div');
		row.appendChild(document.createTextNode(field_key));
		list_form.appendChild(row);
		field_specs[field_key].forEach(function(spec, i) {
			var input = document.createElement((spec.type === 'select') ? 'select' : 'input');
			input.setAttribute('data-idx', i);
			input.setAttribute('data-key', field_key);
			if (spec.type === 'boolean') {
				input.setAttribute('type', 'checkbox');
			} else if (spec.type === 'string') {
				input.setAttribute('value', cnt++);
			} else if ((spec.type === 'select') && spec.options) {
				spec.options.forEach(function(ostr) {
					var option_el = document.createElement('option');
					option_el.appendChild(document.createTextNode(ostr));
					option_el.setAttribute('value', ostr);
					input.appendChild(option_el);
				});
			}
			row.appendChild(input);
		});
	}
}

// Example of filling out fields
function fill(buf) {
	var list_form = document.querySelector('.list_form');
	var fields = {};
	list_form.querySelectorAll('input,select').forEach(function(input) {
		var key = input.getAttribute('data-key');
		if (!fields[key]) {
			fields[key] = [];
		}
		var index = parseInt(input.getAttribute('data-idx'), 10);
		var value = (input.getAttribute('type') === 'checkbox') ? input.checked : input.value;
		fields[key][index] = value;
	});

	var filled_pdf; // Uint8Array
	try {
		filled_pdf = make_pdfform().transform(buf, fields);
	} catch (e) {
		return on_error(e);
	}

	var blob = new Blob([filled_pdf], {type: 'application/pdf'});
	saveAs(blob, 'pdfform.js_generated.pdf');
}


// From here on just code for this demo.
// This will not feature in your website
function on_error(e) {
	console.error(e, e.stack);  // eslint-disable-line no-console
	var div = document.createElement('div');
	div.appendChild(document.createTextNode(e.message));
	document.querySelector('.error').appendChild(div);
}

function empty(node) {
	var last;
	while ((last = node.lastChild)) {
		node.removeChild(last);
	}
}

var current_buffer;

function on_file(filename, buf) {
	current_buffer = buf;
	document.querySelector('.url_form').setAttribute('style', 'display: none');
	var cur_file = document.querySelector('.cur_file');
	empty(cur_file);
	cur_file.setAttribute('style', 'display: block');
	cur_file.appendChild(document.createTextNode('loaded file ' + filename + ' (' + buf.byteLength + ' Bytes)'));
	var reload_btn = document.createElement('button');
	reload_btn.appendChild(document.createTextNode('use another file'));
	cur_file.appendChild(reload_btn);
	document.querySelector('.fill').removeAttribute('disabled');

	list(current_buffer);
}

document.addEventListener('DOMContentLoaded', function() {
	// Download by URL
	// Note that this just works for URLs in the same origin, see Same-Origin Policy
	var url_form = document.querySelector('.url_form');
	url_form.addEventListener('submit', function(e) {
		e.preventDefault();
		var url = document.querySelector('input[name="url"]').value;

		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.responseType = 'arraybuffer';

		xhr.onload = function() {
			if (this.status == 200) {
				on_file(url.split(/\//).pop(), this.response);
			} else {
				on_error('failed to load URL (code: ' + this.status + ')');
			}
		};

		xhr.send();
	});

	document.querySelector('.url_form input[name="file"]').addEventListener('change', function(e) {
		var file = e.target.files[0];
		var reader = new FileReader();
		reader.onload = function(ev) {
			on_file(file.name, ev.target.result);
		};
		reader.readAsArrayBuffer(file);
	});

	var fill_form = document.querySelector('.fill_form');
	fill_form.addEventListener('submit', function(e) {
		e.preventDefault();
		fill(current_buffer);
	});

	var cur_file = document.querySelector('.cur_file');
	cur_file.addEventListener('submit', function(e) {
		e.preventDefault();
		empty(document.querySelector('.error'));
		cur_file.setAttribute('style', 'display: none');
		url_form.setAttribute('style', 'display: block');
	});

	var pdflib_radios = document.querySelectorAll('input[name="pdflib"]');
	for (var i = 0;i < pdflib_radios.length;i++) {
		var r = pdflib_radios[i];
		r.addEventListener('change', function() {
			if (current_buffer) {
				list(current_buffer);
			}
		});
	}

	document.querySelector('.loading').setAttribute('style', 'display: none');
});
