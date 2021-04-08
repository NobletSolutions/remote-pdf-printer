'use strict';

const multer = require('multer');

let formMulter = multer();

module.exports = function(app) {
    const pdfPrinter = require('../controllers/printPdfController');

    app.route('/pdf')
        .post(pdfPrinter.print, formMulter.none());

    app.route('/pdf/preview')
        .post(pdfPrinter.preview, formMulter.none());

    app.route('/pdf/:file')
        .get(pdfPrinter.get_pdf, formMulter.none());

    app.route('/pdf/preview/:file')
        .get(pdfPrinter.get_preview, formMulter.none());
};
