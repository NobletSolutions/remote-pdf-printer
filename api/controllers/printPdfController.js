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

const options = {
    port: process.env.CHROME_PORT || 1337,
    printOptions: {
        printBackground: true
    },
    dir: process.env.DIR || __dirname + '/../../files/'
};

async function load(html) {
    console.log('Load(html) called');
    let tab = undefined;
    try {
        tab = await CDP.New({port: options.port});
        const client = await CDP({tab});
        const {Network, Page} = client;
        await Promise.all([Network.enable(), Page.enable()]);
        return new Promise(async (resolve, reject) => {
            let failed = false;
            const url = /^(https?|file|data):/i.test(html) ? html : `data:text/html,${html}`;

            Network.loadingFailed((params) => {
                failed = true;

                console.log('Load(html) Network.loadingFailed: "'+params.errorText+'"');
                reject(new Error('Load(html) unable to load remote URL: ' + url));
            });

            Network.requestWillBeSent((params) => {
               console.log('Load(html) Request ('+params.requestId+') will be sent: '+params.request.url);
            });

            Network.responseReceived((params) => {
              console.log('Load(html) Response Received: ('+params.requestId+') Status: '+params.response.status);
            });

            Page.navigate({url});
            await Page.loadEventFired();
            if (!failed) {
                await delay(500);
                console.log('Load(html) resolved');
                resolve({client: client, tab: tab});
                return;
            }
            await CDP.Close({port: options.port, id: tab.id});
        });
    } catch (error) {
        console.log('Load(html) error: ' + error);
        if (tab) {
            console.log('Load(html) closing open tab');
            CDP.Close({port: options.port, id: tab.id});
        }
    }
}

async function getPdf(html) {
    const {client, tab} = await load(html);
    const {Page} = client;

    // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Page/#method-printToPDF
    const pdf = await Page.printToPDF(options.printOptions);
    await CDP.Close({port: options.port, id: tab.id});

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

