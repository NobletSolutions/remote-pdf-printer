var express = require('express');
var fs = require('fs');
var https = require('https');
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
	port: process.env.PORT || 3000,
	keyPath: process.env.SSL_KEY || 'privkey.pem',
	certPath: process.env.SSL_CERT || 'cert.pem'
};

bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
var routes = require('./api/routes/printPdfRoutes');
routes(app);

console.log('KEY: '+options.keyPath+"\nCert: "+options.certPath+"\nPort: "+options.port+"\nFiles: "+options.dir);
https.createServer({key: fs.readFileSync(options.keyPath),cert: fs.readFileSync(options.certPath)},app).listen(options.port);

console.log('HTML to PDF RESTful API server started');
