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
            function complete(options) {
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

                console.log('Load(html) Network.loadingFailed: "' + params.errorText + '"');
                reject(new Error('Load(html) unable to load remote URL'));
            });

            Network.requestWillBeSent((params) => {
                if (completed === true) {
                    postResolvedRequests[params.requestId] = 1;
                }

                console.log('Load(html) Request (' + params.requestId + ') will be sent: ' + params.request.url);
            });

            Network.responseReceived((params) => {
                console.log('Load(html) Response Received: (' + params.requestId + ') Status: ' + params.response.status);

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

async function getPng(html, printOptions) {
    const {client, target} = await load(html);
    const {Page} = client;

    // https://chromedevtools.github.io/devtools-protocol/tot/Page#type-Viewport
    const png = await Page.captureScreenshot(printOptions);
    await CDP.Close({port: options.port, id: target.id});

    return png;
}

function servePng(res, filename) {
    res.setHeader('Content-disposition', 'attachment; filename=' + filename + '.png');
    res.setHeader('Content-type', 'image/png');
    let stream = fs.createReadStream(options.dir + '/' + filename);
    stream.pipe(res);
}

function getPrintOptions(body) {
    let printOptions = {
        clip: {
            x: 0,
            y: 0,
            width: 1020.0,
            height: 150.0,
            scale: 1
        }
    };

    console.log('Get Print Options');

    if (body) {
        if (body.width) {
            printOptions.clip.width = parseFloat(body.width);
        } else if (options.debug) {
            console.log('No Width');
        }

        if (body.height) {
            printOptions.clip.height = parseFloat(body.height);
        } else if (options.debug) {
            console.log('No Height');
        }
    } else if (options.debug) {
        console.log('No body');
    }

    console.log('Options: ', printOptions);

    return printOptions;
}

exports.print_url = function (req, res) {
    if (!req.query.url || req.query.url === undefined) {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: 'No url submitted'});
        return;
    }

    console.log('Request for ' + req.query.url);

    let printOptions = getPrintOptions(req.body);

    getPng(req.query.url, printOptions).then(async (png) => {
        const randomPrefixedTmpFile = uniqueFilename(options.dir);

        await fs.writeFileSync(randomPrefixedTmpFile, Buffer.from(png.data, 'base64'), (error) => {
            if (error) {
                throw error;
            }
        });

        console.log('wrote file ' + randomPrefixedTmpFile + ' successfully');

        if (!req.query.download || req.query.download === false) {
            res.json({url: req.query.url, png: path.basename(randomPrefixedTmpFile) + '.png'});
            return;
        }

        servePng(res, path.basename(randomPrefixedTmpFile));
    }).catch((error) => {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: error.message});
        console.log('Caught ' + error);
    });
};

exports.print_html = function (req, res) {
    if (!req.body.data || req.body.data === undefined) {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: 'No data submitted'});
        return;
    }

    console.log('Request Content-Length: ' + (req.body.data.length / 1024) + 'kb');

    if (options.debug) {
        const randomPrefixedHtmlFile = uniqueFilename(options.dir);
        fs.writeFile(randomPrefixedHtmlFile, req.body.data, (error) => {
            if (error) {
                throw error;
            }
        });

        console.log('wrote HTML file ' + randomPrefixedHtmlFile + ' successfully');
    }

    let printOptions = getPrintOptions(req.body);

    getPng(req.body.data, printOptions).then(async (png) => {
        const randomPrefixedTmpFile = uniqueFilename(options.dir);

        await fs.writeFileSync(randomPrefixedTmpFile, Buffer.from(png.data, 'base64'), (error) => {
            if (error) {
                throw error;
            }
        });

        console.log('wrote file ' + randomPrefixedTmpFile + ' successfully');
        if (!req.body.download || req.body.download === false) {
            res.json({length: req.body.data.length, png: path.basename(randomPrefixedTmpFile) + '.png'});
            return;
        }

        servePng(res, path.basename(randomPrefixedTmpFile));
    }).catch((error) => {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: error.message});
        console.log('Caught ' + error);
    });
};

exports.get_png = function (req, res) {
    // Ensure no one tries a directory traversal
    if (req.query.file.indexOf('..') !== -1 || req.query.file.indexOf('.png') === -1) {
        res.status(400).send('Invalid filename!');
        return;
    }

    servePng(res, req.query.file.replace('.png', ''));
};
