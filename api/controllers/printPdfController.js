/**
 * Created by gnat on 18/07/17.
 * TODO
 *   Catch errors - Filesystem when we can't write
 *                - Unable to talk to chrome
 *                - Receiving URL without protocol
 */
'use strict';

const uniqueFilename = require('unique-filename');
const htmlPdf = require('html-pdf-chrome');
const path = require('path');
const fs = require('fs');
const options = {
	htmlPDF: {
		port: process.env.CHROME_PORT || 1337,
		printOptions: {
		    marginTop: 0,
		    marginRight: 0,
		    marginLeft:0,
		    printBackground: true,
		}
	},
	dir: process.env.DIR || __dirname+'/../../files/'
};

exports.print_url = function(req, res) {
    var randomPrefixedTmpfile = uniqueFilename(options.dir);
    htmlPdf.create(req.query.url, options.htmlPDF).then((pdf) => pdf.toFile(randomPrefixedTmpfile));
    res.json({url: req.query.url, pdf: path.basename(randomPrefixedTmpfile)});
};

exports.print_html = function(req, res) {
    var randomPrefixedTmpfile = uniqueFilename(options.dir);
    htmlPdf.create(req.body.data, options.htmlPDF).then((pdf) => pdf.toFile(randomPrefixedTmpfile));
    res.json({length: req.body.data.length, pdf: path.basename(randomPrefixedTmpfile)});
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

