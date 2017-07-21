/**
 * Created by gnat on 18/07/17.
 */
'use strict';

const uniqueFilename = require('unique-filename');
const htmlPdf = require('html-pdf-chrome');
const path = require('path');
const fs = require('fs');


exports.print_url = function(req, res) {
    var randomPrefixedTmpfile = uniqueFilename(options.dir);
    htmlPdf.create(req.query.url, options.htmlPDF).then((pdf) => pdf.toFile(randomPrefixedTmpfile));
    res.json('{url: "'+req.query.url+'", pdf: "'+path.basename(randomPrefixedTmpfile)+'"}');
};

exports.print_html = function(req, res) {
    var randomPrefixedTmpfile = uniqueFilename(options.dir);
    htmlPdf.create(req.body.data, options.htmlPDF).then((pdf) => pdf.toFile(randomPrefixedTmpfile));
    res.json('{length: '+req.body.data.length+', pdf: "'+path.basename(randomPrefixedTmpfile)+'"}}');
};

exports.get_pdf = function(req,res) {
	// Ensure no one tries a directory traversal
	if(req.query.file.indexOf('..') !== -1) {
		res.status(400).send('Invalid filename!');
		return;
	}

    res.setHeader('Content-disposition', 'attachment; filename=output.pdf');
    res.setHeader('Content-type', 'application/pdf');
    var filestream = fs.createReadStream(options.dir+'/'+req.query.file);
    filestream.pipe(res);
};

