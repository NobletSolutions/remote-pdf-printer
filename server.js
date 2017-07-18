var express = require('express'),
app = express(),
port = process.env.PORT || 3000;
bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
var routes = require('./api/routes/printPdfRoutes');
routes(app);

app.listen(port);

console.log('HTML to PDF RESTful API server started on: ' + port);
