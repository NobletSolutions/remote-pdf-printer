/**
 * Created by gnat on 18/07/17.
 */
'use strict';
module.exports = function(app) {
    const pdfPrinter = require('../controllers/printPdfController');

    // todoList Routes
    app.route('/pdf/url')
        .get(pdfPrinter.print_url);

    app.route('/pdf/html')
        .post(pdfPrinter.print_html);

    app.route('/pdf/get')
        .get(pdfPrinter.get_pdf);
};
