'use strict';

module.exports = function(app, formMulter) {
    const pngPrinter = require('../controllers/printPngController');

    // todoList Routes
    app.post('/png', formMulter.none(), pngPrinter.print);

    app.route('/png/:file')
        .get(pngPrinter.get_png);
};
