const express = require('express');
const fs = require('fs');
const https = require('https');
const logger = require('morgan');
app = express();

const options = {
	port: process.env.PORT || 3000,
	address: process.env.LISTEN || '127.0.0.1',
	keyPath: process.env.SSL_KEY || 'privkey.pem',
	certPath: process.env.SSL_CERT || 'cert.pem'
};

bodyParser = require('body-parser');

app.use(logger('combined',{stream: fs.createWriteStream('/var/log/remote-pdf-printer.log')}));
app.use(bodyParser.urlencoded({ extended: true }));
const routes = require('./api/routes/printPdfRoutes');
routes(app);

console.log('KEY: '+options.keyPath+"\nCert: "+options.certPath+"\nPort: "+options.port);
https.createServer({
	key: fs.readFileSync(options.keyPath),
	cert: fs.readFileSync(options.certPath)
},app).listen(options.port,options.address);

console.log('HTML to PDF RESTful API server started');
