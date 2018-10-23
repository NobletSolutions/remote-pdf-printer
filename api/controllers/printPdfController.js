/**
 * Created by gnat on 18/07/17.
 * TODO
 *   Catch errors - Filesystem when we can't write
 *                - Unable to talk to chrome
 *                - Receiving URL without protocol
 */
'use strict';

const uniqueFilename = require('unique-filename');
const path = require('path');
const fs = require('fs');
const CDP = require('chrome-remote-interface');

let headerFooterStyle = `<style type="text/css" media="print">
		/* Do not edit below this line */
		@page
		{
		    margin: 0;
		    padding: 0;
		}

		html {
		    margin: 0;
		    padding: 0;
		    overflow: hidden;
		}

		body {
		    margin: 0;
		    padding: 0;
		    height: 100%;
		    overflow: hidden;
		}

		* {
		    -webkit-print-color-adjust: exact;
		    box-sizing: border-box;
		}

        header {
		    position: relative;
		    top: -0.16in; /* Do not change this */
		    height: 1.5in; /* Must match marginTop minus header padding */
		    background-size: cover;
		    font-size: 11pt;
		    overflow: hidden;
		    padding: 0.25in;
		    margin: 0;
		    width: 100%;
		}

		footer {
            position: relative;
            bottom: -0.16in; /* Do not change this */
            height: 0.75in; /* Must match marginBottom minus footer padding */
            background-size: cover;
            font-size: 11pt;
            overflow: hidden;
            padding: 0.125in;
            margin: 0;
            width: 100%;
        }
</style>`;

const options = {
    port: process.env.CHROME_PORT || 1337,
    printOptions: {
        printBackground: true
    },
    debug: process.env.DEBUG || false,
    dir: process.env.DIR || __dirname + '/../../files/'
};

async function load(html) {
    console.log('Load(html) called');
    let target = undefined;
    try {
        console.log('Load using ports ' + options.port);
        target = await CDP.New({port: options.port});
        const client = await CDP({target});
        const {Network, Page} = client;
        await Promise.all([Network.enable(), Page.enable()]);
        return new Promise(async (resolve, reject) => {
            function complete(options)
            {
                console.log('Load(html) *actually* resolved');
                resolve(options);
            }

            let resolveOptions = {client: client, target: target};
            let failed = false;
            let completed = false;
            let postResolvedRequests = [];
            const url = /^(https?|file|data):/i.test(html) ? html : `data:text/html,${html}`;

            Network.loadingFailed((params) => {
                failed = true;

                console.log('Load(html) Network.loadingFailed: "'+params.errorText+'"');
                reject(new Error('Load(html) unable to load remote URL'));
            });

            Network.requestWillBeSent((params) => {
                if (completed === true) {
                    postResolvedRequests[params.requestId] = 1;
                }

                console.log('Load(html) Request ('+params.requestId+') will be sent: '+params.request.url);
            });

            Network.responseReceived((params) => {
                console.log('Load(html) Response Received: ('+params.requestId+') Status: '+params.response.status);

                if (completed === true) {
                    delete postResolvedRequests[params.requestId];
                    if (postResolvedRequests.length === 0) {
                        clearTimeout(waitForResponse);
                        complete(resolveOptions);
                    }
                }
            });

            Page.navigate({url});
            await Page.loadEventFired();
            console.log('Load(html) resolved');

            let waitForResponse = false;

            if (failed) {
                await CDP.Close({port: options.port, id: target.id});
            }

            completed = true;
            waitForResponse = setTimeout(complete, 750, resolveOptions);
        });
    } catch (error) {
        console.log('Load(html) error: ' + error);
        if (target) {
            console.log('Load(html) closing open target');
            CDP.Close({port: options.port, id: target.id});
        }
    }
}

async function getPdf(html) {
    const {client, target} = await load(html);
    const {Page} = client;

    // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Page/#method-printToPDF
    const pdf = await Page.printToPDF(options.printOptions);
    await CDP.Close({port: options.port, id: target.id});

    return pdf;
}

function servePdf(res, filename) {
    res.setHeader('Content-disposition', 'attachment; filename=' + filename +'.pdf');
    res.setHeader('Content-type', 'application/pdf');
    let stream = fs.createReadStream(options.dir + '/' + filename);
    stream.pipe(res);
}

exports.print_url = function (req, res) {
    if (!req.query.url || req.query.url === undefined) {
        res.status(400).json({error: 'Unable to generate/save PDF!', message: 'No url submitted'});
        return;
    }

    console.log('Request for ' + req.query.url);

    if (req.body && req.body.header) {
        if (!req.body.marginTop) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a header template the marginTop is required'
            });
        }

        options.printOptions.displayHeaderFooter = true;
        options.printOptions.headerTemplate = headerFooterStyle + req.body.header;
        options.printOptions.marginTop = parseFloat(req.body.marginTop);
    }

    if (req.body && req.body.footer) {
        if (!req.body.marginBottom) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a footer template the marginBottom is required'
            });
        }

        options.printOptions.displayHeaderFooter = true;
        options.printOptions.headerTemplate = headerFooterStyle + req.body.footer;
        options.printOptions.marginBottom = parseFloat(req.body.marginBottom);
    }

    getPdf(req.query.url).then(async (pdf) => {
        const randomPrefixedTmpFile = uniqueFilename(options.dir);

        await fs.writeFileSync(randomPrefixedTmpFile, Buffer.from(pdf.data, 'base64'), (error) => {
            if (error) {
                throw error;
            }
        });

        console.log('wrote file ' + randomPrefixedTmpFile + ' successfully');

        if (!req.query.download || req.query.download === false) {
            res.json({url: req.query.url, pdf: path.basename(randomPrefixedTmpFile) + '.pdf'});
            return;
        }

        servePdf(res, path.basename(randomPrefixedTmpFile));
    }).catch((error) => {
        res.status(400).json({error: 'Unable to generate/save PDF!', message: error.message});
        console.log('Caught ' + error);
    });
};

exports.print_html = function (req, res) {
    if (!req.body.data || req.body.data === undefined) {
        res.status(400).json({error: 'Unable to generate/save PDF!', message: 'No data submitted'});
        return;
    }

    console.log('Request Content-Length: ' + (req.body.data.length/1024)+'kb');

    if (options.debug) {
        const randomPrefixedHtmlFile = uniqueFilename(options.dir);
        fs.writeFile(randomPrefixedHtmlFile, req.body.data, (error) => {
            if (error) {
                throw error;
            }
        });
    }

    if (req.body.header) {
        if (!req.body.marginTop) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a header template the marginTop is required'
            });
        }

        options.printOptions.displayHeaderFooter = true;
        options.printOptions.headerTemplate = headerFooterStyle + req.body.header;
        options.printOptions.marginTop = parseFloat(req.body.marginTop);
    }

    if (req.body.footer) {
        if (!req.body.marginBottom) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a footer template the marginBottom is required'
            });
        }

        options.printOptions.displayHeaderFooter = true;
        options.printOptions.headerTemplate = headerFooterStyle + req.body.footer;
        options.printOptions.marginBottom = parseFloat(req.body.marginBottom);
    }

    getPdf(req.body.data).then(async (pdf) => {
        const randomPrefixedTmpFile = uniqueFilename(options.dir);

        await fs.writeFileSync(randomPrefixedTmpFile, Buffer.from(pdf.data, 'base64'), (error) => {
            if (error) {
                throw error;
            }
        });

        console.log('wrote file ' + randomPrefixedTmpFile + ' successfully');
        if (!req.body.download || req.body.download === false) {
            res.json({length: req.body.data.length, pdf: path.basename(randomPrefixedTmpFile) + '.pdf'});
            return;
        }

        servePdf(res, path.basename(randomPrefixedTmpFile));
    }).catch((error) => {
        res.status(400).json({error: 'Unable to generate/save PDF!', message: error.message});
        console.log('Caught ' + error);
    });
};

exports.get_pdf = function (req, res) {
    // Ensure no one tries a directory traversal
    if (req.query.file.indexOf('..') !== -1 || req.query.file.indexOf('.pdf') === -1) {
        res.status(400).send('Invalid filename!');
        return;
    }

    servePdf(res, req.query.file.replace('.pdf',''));
};
