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
const poppler = require('pdf-poppler');

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
		    font-size: 11pt;
		    width: 100%;
		}

		footer {
            position: relative;
            bottom: -0.16in; /* Do not change this */
            font-size: 10pt;
            width: 100%;
        }
</style>`;

const options = {
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
            console.log(`Load using ports ${options.port}`);
        }

        target = await CDP.New({port: options.port});
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
            const url = /^(https?|file|data):/i.test(html) ? html : `data:text/html,${html}`;

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

async function getPdf(html, printOptions) {
    const {client, target} = await load(html);
    const {Page} = client;

    // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Page/#method-printToPDF
    const pdf = await Page.printToPDF(printOptions);
    await CDP.Close({port: options.port, id: target.id});

    return pdf;
}

function writeFile(fileName, pdfStream) {
    return new Promise(function (resolve, reject) {
        fs.writeFileSync(fileName, Buffer.from(pdfStream.data, 'base64'), (error) => {
            if (error) {
                reject(error);
            }
        });

        if (options.debug) {
            console.log(`wrote file ${fileName} successfully`);
        }

        resolve(fileName);
    });
}

function returnPdfResponse(req, res, pathname) {
    if (!req.body.download || req.body.download === false) {
        let filename = path.basename(pathname) + '.pdf';
        res.json({
            pdf: filename,
            url: req.protocol + '://' + req.get('host') + '/pdf/' + filename,
        });
        return;
    }

    servePdf(res, path.basename(pathname));
}

function returnPreviewResponse(req, res, pdfInfo, pathname) {
    let filename = path.basename(pathname);
    let baseUrl  = req.protocol + '://' + req.get('host') + '/pdf/preview/';

    let response = {
        success: true,
        pages: pdfInfo.pages,
        images: []
    };

    const pad = require('pad-left');
    for (let x = 1; x <= pdfInfo.pages; x++) {
        response.images.push(baseUrl + filename + '-' + pad(x, pdfInfo.pages.length, '0') + '.jpg')
    }

    res.json(response);
}

function writeFiles(pdfs, outputFile) {
    return new Promise(function (resolve, reject) {
        // More than one document produced..
        let inputFiles = [];

        pdfs.forEach(async function (individualPdf, index) {
            let fileName = outputFile + '-' + index;
            inputFiles.push(fileName);
            await writeFile(fileName, individualPdf);
        });

        if (inputFiles.length === 0) {
            reject(Error('No Input Files'));
        }

        resolve(inputFiles);
    });
}

async function combine(inputFiles, outputFile) {
    await poppler.combine(inputFiles, outputFile);
    return outputFile;
}

async function convert(outputFile) {
    let opts = {
        format: 'jpeg',
        out_dir: options.dir + '/previews/',
        out_prefix: path.basename(outputFile, '.pdf'),
        page: null
    };

    await poppler.convert(outputFile, opts);

    return outputFile;
}

function info(outputFile) {
    return poppler.info(outputFile);
}

function isFile(fullpath) {
    try {
        return fs.statSync(fullpath).isFile()
    } catch (e) {
        return false
    }
}

function servePdf(res, filename) {
    let fullpath = `${options.dir}/pdfs/${filename}`;
    if (options.debug) {
        console.log('Requesting Filename: ' + fullpath);
    }

    if (!isFile(fullpath)) {
        res.status(404).send('No such file');
        return;
    }

    res.setHeader('Content-disposition', `attachment; filename=${filename}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    let stream = fs.createReadStream(fullpath);
    stream.pipe(res);
}

function getPrintOptions(body, res) {
    let printOptions = {
        printBackground: true
    };

    if (options.debug) {
        console.log('Request Keys ' + Object.keys(body));
    }

    if (body && body.header) {
        if (!body.marginTop) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a header template the marginTop is required'
            });
        }

        if (options.debug) {
            console.log('Have Header');
        }

        printOptions.displayHeaderFooter = true;
        printOptions.headerTemplate = headerFooterStyle + body.header;
        printOptions.footerTemplate = '<footer></footer>';

        let requestedMargin = parseFloat(body.marginTop);
        let adjustment = 0.35;
        if (requestedMargin - 1 > 0) {
            adjustment += 0.35 * (requestedMargin - 1);
        }

        printOptions.marginTop = requestedMargin + adjustment; //accounts for the odd -0.16in margins
    } else if (options.debug) {
        console.log('No Header');
    }

    if (body && body.footer) {
        if (!body.marginBottom) {
            res.status(400).json({
                error: 'Unable to generate/save PDF!',
                message: 'When providing a footer template the marginBottom is required'
            });
        }

        if (options.debug) {
            console.log('Have Footer');
        }

        printOptions.displayHeaderFooter = true;
        printOptions.footerTemplate = headerFooterStyle + body.footer;
        if (!printOptions.headerTemplate) {
            printOptions.headerTemplate = '<header></header>';
        }

        let requestedMargin = parseFloat(body.marginBottom);
        let adjustment = 0.35;
        if (requestedMargin - 1 > 0) {
            adjustment += 0.35 * (requestedMargin - 1);
        }

        printOptions.marginBottom = requestedMargin + adjustment;

    } else if (options.debug) {
        console.log('No Footer');
    }

    if (body && body.marginLeft) {
        printOptions.marginLeft = parseFloat(body.marginLeft);
    }

    if (body && body.marginRight) {
        printOptions.marginRight = parseFloat(body.marginRight);
    }

    return printOptions;
}

function servePreview(res, filename) {
    let fullpath = `${options.dir}/previews/${filename}`;
    if (options.debug) {
        console.log('Requesting Filename: ' + fullpath);
    }

    if (!isFile(fullpath)) {
        res.status(404).send('No such file');
        return;
    }

    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'image/jpeg');
    let stream = fs.createReadStream(fullpath);
    stream.pipe(res);
}

function getData(req, res) {
    if (req.body.data !== undefined) {
        return Array.isArray(req.body.data) ? req.body.data : [req.body.data];
    }

    if (req.body.url !== undefined) {
        return Array.isArray(req.body.url) ? req.body.url : [req.body.url];
    }

    res.status(400).json({error: 'Unable to retrieve data to generate PDF!', message: 'No url / data submitted'});
}

exports.print = function (req, res) {
    let data = getData(req);

    if (options.debug) {
        console.log('Request Content-Length: ' + (data.length / 1024) + 'kb');
    }

    if (options.debug_sources) {
        const randomPrefixedHtmlFile = uniqueFilename(options.dir + '/sources/');
        fs.writeFile(randomPrefixedHtmlFile, data, (error) => {
            if (error) {
                throw error;
            }
        });

        console.log(`Wrote HTML file ${randomPrefixedHtmlFile} successfully`);
    }

    let printOptions = getPrintOptions(req.body, res);

    let promises = [];
    data.forEach(function (element) {
        promises.push(getPdf(element, printOptions));
    });

    Promise
        .all(promises)
        .then((pdfs) => {
            const randomPrefixedTmpFile = uniqueFilename(options.dir + '/pdfs/');
            if (pdfs.length === 1) {
                writeFile(randomPrefixedTmpFile, pdfs[0])
                    .then(() => {
                        return returnPdfResponse(req, res, randomPrefixedTmpFile);
                    })
                    .catch((error) => {
                        console.log(`Caught Error ${error}`);
                        res.status(400).json({error: 'Unable to generate PDF!'});
                    });

                return;
            }

            writeFiles(pdfs, randomPrefixedTmpFile)
                .then((inputFiles) => {
                    return combine(inputFiles, randomPrefixedTmpFile);
                })
                .then((outputFile) => {
                    returnPdfResponse(req, res, outputFile);
                });
        })
        .catch((error) => {
            console.log(`Caught Error ${error}`);
            res.status(400).json({error: 'Unable to generate PDF!'});
        });
};

exports.preview = function (req, res) {
    let data = getData(req, res);

    if (options.debug) {
        console.log('Request Content-Length: ' + (data.length / 1024) + 'kb');
    }

    if (options.debug_sources) {
        const randomPrefixedHtmlFile = uniqueFilename(options.dir + '/sources/');
        fs.writeFile(randomPrefixedHtmlFile, data, (error) => {
            if (error) {
                throw error;
            }
        });

        console.log(`Wrote HTML file ${randomPrefixedHtmlFile} successfully`);
    }

    let printOptions = getPrintOptions(req.body, res);

    let promises = [];
    data.forEach(function (element) {
        promises.push(getPdf(element, printOptions));
    });

    Promise
        .all(promises)
        .then((pdfs) => {
            const randomPrefixedTmpFile = uniqueFilename(options.dir + '/pdfs/');
            if (pdfs.length === 1) {
                let pdfInfo = undefined;
                writeFile(randomPrefixedTmpFile, pdfs[0])
                    .then((outputFile) => {
                        info(outputFile).then((info) => {
                            pdfInfo = info;
                        });
                        return outputFile;
                    })
                    .then((outputFile) => {
                        return convert(outputFile);
                    })
                    .then((outputFile) => {
                        returnPreviewResponse(req, res, pdfInfo, outputFile);
                    })
                    .catch((error) => {
                        console.log(`Caught: ${error}`);
                        res.status(400).json({error: 'Unable to generate PDF preview!'});
                    });

                return;
            }

            let pdfInfo = undefined;
            writeFiles(pdfs, randomPrefixedTmpFile)
                .then((inputFiles) => {
                    return combine(inputFiles, randomPrefixedTmpFile);
                })
                .then((outputFile) => {
                    info(outputFile).then((info) => {
                        pdfInfo = info;
                    });
                    return outputFile;
                })
                .then((outputFile) => {
                    return convert(outputFile);
                })
                .then((outputFile) => {
                    returnPreviewResponse(req, res, pdfInfo, outputFile);
                })
                .catch((error) => {
                    console.log(`Caught Error: ${error}`);
                    res.status(400).json({error: 'Unable to generate PDF preview!'});
                });
        })
        .catch((error) => {
            console.log(`Caught: ${error}`);
            res.status(400).json({error: 'Unable to generate PDF preview!'});
        });
};

exports.get_pdf = function (req, res) {
    const {file} = req.params;

    // Ensure no one tries a directory traversal
    if (!file || file.indexOf('..') !== -1 || file.indexOf('.pdf') === -1) {
        res.status(404).send('Invalid filename!');
        return;
    }

    servePdf(res, file.replace('.pdf', ''));
};

exports.get_preview = function (req, res) {
    const {file} = req.params;

    // Ensure no one tries a directory traversal
    if (!file || file.indexOf('..') !== -1 || file.indexOf('.jpg') === -1) {
        res.status(404).send('Invalid filename!');
        return;
    }

    servePreview(res, file);
};
