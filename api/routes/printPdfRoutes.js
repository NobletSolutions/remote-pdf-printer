'use strict';

module.exports = function(app, formMulter) {
    const pdfPrinter = require('../controllers/printPdfController');

    app.post('/pdf', formMulter.none(), pdfPrinter.print);

    app.post('/pdf/preview', formMulter.none(), pdfPrinter.preview);

    app.route('/pdf/:file')
        .get(pdfPrinter.get_pdf);

    app.route('/pdf/preview/:file')
        .get(pdfPrinter.get_preview);
};
