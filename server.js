const express = require('express');
const fs = require('fs');
const https = require('https');
const logger = require('morgan');
const helmet = require('helmet');
const constants = require('constants');
app = express();

const options = {
	port: process.env.PORT || 3000,
	address: process.env.LISTEN || '127.0.0.1',
	use_ssl: process.env.USE_SSL || true,
	keyPath: process.env.SSL_KEY || 'privkey.pem',
	certPath: process.env.SSL_CERT || 'cert.pem',
    caPath: process.env.SSL_CA || 'chain.pem',
    logPath: process.env.LOG_PATH || '/var/log',
};

bodyParser = require('body-parser');
app.use(helmet());
app.use(logger('combined',{stream: fs.createWriteStream(options.logPath+'/remote-pdf-printer.log')}));
app.use(bodyParser.urlencoded({limit: '10mb', extended: true }));
const pdfRoutes = require('./api/routes/printPdfRoutes');
const pngRoutes = require('./api/routes/printPngRoutes');
pdfRoutes(app);
pngRoutes(app);

if(options.use_ssl === true) {
    console.log('USING SSL! KEY: '+options.keyPath+"\nCert: "+options.certPath+"\nPort: "+options.port);
    https.createServer({
        secureOptions: constants.SSL_OP_NO_TLSv1|constants.SSL_OP_NO_SSLv2|constants.SSL_OP_NO_SSLv3,
        key: fs.readFileSync(options.keyPath),
        cert: fs.readFileSync(options.certPath),
        ca: [ fs.readFileSync(options.caPath)]
    },app).listen(options.port,options.address);
} else {
    console.log("**NOT** USING SSL! \nPort: "+options.port);
	app.listen(options.port,options.address);
}

console.log('HTML to PDF RESTful API server started');
