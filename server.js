var express = require('express'),
app = express();

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
	dir: process.env.DIR || __dirname+'/files',
	port: process.env.PORT || 3000
};

bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
var routes = require('./api/routes/printPdfRoutes');
routes(app);

app.listen(options.port);

console.log('HTML to PDF RESTful API server started on: ' + options.port +' Files Dir: '+options.dir);
