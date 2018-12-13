/**
 * Created by gnat on 18/07/17.
 */
'use strict';
module.exports = function(app) {
    const pngPrinter = require('../controllers/printPngController');

    // todoList Routes
    app.route('/png/url')
        .get(pngPrinter.print_url);

    app.route('/png/html')
        .post(pngPrinter.print_html);

    app.route('/png/get')
        .get(pngPrinter.get_png);
};
