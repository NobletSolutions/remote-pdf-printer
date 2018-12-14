/**
 * Created by gnat on 18/07/17.
 */
'use strict';
module.exports = function(app) {
    const pngPrinter = require('../controllers/printPngController');

    // todoList Routes
    app.route('/png')
        .post(pngPrinter.print);

    app.route('/png/:file')
        .get(pngPrinter.get_png);
};
