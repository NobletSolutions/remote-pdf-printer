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
    url: process.env.CHROME_URL || false,
    port: process.env.CHROME_PORT || 1337,
    debug: process.env.DEBUG || false,
    debug_sources: process.env.DEBUG || process.env.DEBUG_SOURCES || false,
    dir: process.env.DIR || __dirname + '/../../files/'
};

async function load(html) {
    if (options.debug) {
        console.log('Load(html) called');
    }

    let target = undefined;
    try {
        if (options.debug) {
            console.log(`Connect to chrome => (${options.url}):${options.port}`);
        }

        const connectionOptions = {port: options.port, method: 'PUT'};
        // Allow connecting to remote chrome instances
        if (options.url) {
            connectionOptions['url'] = options.url;
        }

        target = await CDP.New(connectionOptions);
        const client = await CDP({target});
        const {Network, Page} = client;
        await Promise.all([Network.enable(), Page.enable()]);
        return new Promise(async (resolve, reject) => {
            function complete(options) {
                if (options.debug) {
                    console.log('Load(html) *actually* resolved');
                }
                resolve(options);
            }

            let resolveOptions = {client: client, target: target};
            let failed = false;
            let completed = false;
            let postResolvedRequests = [];
            const url = /^(https?|file|data):/i.test(html) ? html : 'data:text/html;base64,' + Buffer.from(html).toString('base64');

            Network.loadingFailed((params) => {
                failed = true;

                if (options.debug) {
                    console.log(`Load(html) Network.loadingFailed: "${params.errorText}"`);
                }

                reject(new Error('Load(html) unable to load remote URL'));
            });

            Network.requestWillBeSent((params) => {
                if (completed === true) {
                    postResolvedRequests[params.requestId] = 1;
                }

                if (options.debug) {
                    console.log(`Load(html) Request (${params.requestId}) will be sent: ${params.request.url}`);
                }
            });

            Network.responseReceived((params) => {
                if (options.debug) {
                    console.log(`Load(html) Response Received: (${params.requestId}) Status: ${params.response.status}`);
                }

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
            if (options.debug) {
                console.log('Load(html) resolved');
            }

            let waitForResponse = false;

            if (failed) {
                await CDP.Close({port: options.port, id: target.id});
            }

            completed = true;
            waitForResponse = setTimeout(complete, 750, resolveOptions);
        });
    } catch (error) {
        console.log(`Load(html) error: ${error}`);
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

function isFile(fullpath) {
    try {
        return fs.statSync(fullpath).isFile()
    } catch (e) {
        return false
    }
}

function servePng(res, filename) {
    let fullpath = `${options.dir}/pngs/${filename}`;
    if (options.debug) {
        console.log('Requesting Filename: '+fullpath);
    }

    if (!isFile(fullpath)) {
        res.status(404).send('No such file');
        return;
    }

    res.setHeader('Content-disposition', `attachment; filename=${filename}.png`);
    res.setHeader('Content-type', 'image/png');
    let stream = fs.createReadStream(fullpath);
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

    if (options.debug) {
        console.log('Get Print Options');
    }

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

    if (options.debug) {
        console.log('Options: ', printOptions);
    }

    return printOptions;
}

exports.print = function (req, res) {
    let data = undefined;

    if (req.body.data !== undefined) {
        data = req.body.data;
    }

    if (req.body.url !== undefined) {
        data = req.body.url;
    }

    if (data === undefined) {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: 'No url / data submitted'});
        return;
    }

    if (options.debug_sources) {
        console.log('Request Content-Length: ' + (req.body.data.length / 1024) + 'kb');

        const randomPrefixedHtmlFile = uniqueFilename(options.dir + '/sources/');
        fs.writeFile(randomPrefixedHtmlFile, req.body.data, (error) => {
            if (error) {
                throw error;
            }
        });

        console.log(`wrote HTML file ${randomPrefixedHtmlFile} successfully`);
    }

    let printOptions = getPrintOptions(req.body);

    getPng(req.body.data, printOptions).then(async (png) => {
        const randomPrefixedTmpFile = uniqueFilename(options.dir + '/pngs/');

        await fs.writeFileSync(randomPrefixedTmpFile, Buffer.from(png.data, 'base64'), (error) => {
            if (error) {
                throw error;
            }
        });

        if (options.debug) {
            console.log(`Wrote file ${randomPrefixedTmpFile} successfully`);
        }

        let filename = path.basename(randomPrefixedTmpFile);
        if (!req.body.download || req.body.download === false) {
            res.json({
                png: filename,
                url: req.protocol + '://' + req.get('host') + '/png/' + filename + '.png',
            });
            return;
        }

        servePng(res, filename);
    }).catch((error) => {
        res.status(400).json({error: 'Unable to generate/save PNG!', message: error.message});
        console.log(`Caught ${error}`);
    });
};

exports.get_png = function (req, res) {
    const {file} = req.params;

    // Ensure no one tries a directory traversal
    if (!file || file.indexOf('..') !== -1 || file.indexOf('.png') === -1) {
        res.status(404).send('Invalid filename!');
        return;
    }

    servePng(res, file.replace('.png', ''));
};
