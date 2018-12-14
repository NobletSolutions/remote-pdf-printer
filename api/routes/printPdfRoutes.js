/**
 * Created by gnat on 18/07/17.
 */
'use strict';
module.exports = function(app) {
    const pdfPrinter = require('../controllers/printPdfController');

    app.route('/pdf')
        .post(pdfPrinter.print);

    app.route('/pdf/preview')
        .post(pdfPrinter.preview);

    app.route('/pdf/:file')
        .get(pdfPrinter.get_pdf);

    app.route('/pdf/preview/:file')
        .get(pdfPrinter.get_preview);
};
