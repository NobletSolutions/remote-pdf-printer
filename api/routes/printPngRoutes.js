'use strict';

const multer = require('multer');

let formMulter = multer();

module.exports = function(app) {
    const pngPrinter = require('../controllers/printPngController');

    // todoList Routes
    app.route('/png')
        .post(pngPrinter.print, formMulter.none());

    app.route('/png/:file')
        .get(pngPrinter.get_png, formMulter.none());
};
