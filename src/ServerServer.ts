import * as commands from './common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from './logging';
import { collectServerServerSensorInputs } from './server-server-sensors-parameters';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
const got = require('got');
import { TransformSensor } from './transform-sensor';
import { wrapOption } from './common/requestOption';

const diffMatchPatch = require('diff-match-patch');

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSensors': async () => {
            ServerServer.processSensors(context);
        },
        'hoganslendertanium.generateExportFileMissingSensors': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServer.processMissingSensors(uris[0], uris[1]);
        },
    });
}

class ServerServer {
    public static async processMissingSensors(left: vscode.Uri, right: vscode.Uri) {
        const leftDir = left.fsPath;
        const rightDir = right.fsPath;

        console.log(left.fsPath);
        console.log(right.fsPath);

        // go through files on left and see if it exists on right
        const files: string[] = fs.readdirSync(leftDir);

        const exportSensorObj: any = {
            sensors: {
                include: []
            }
        };

        files.forEach(file => {
            const leftTarget = path.join(leftDir, file);
            const rightTarget = leftTarget.replace(leftDir, rightDir);

            if (!fs.existsSync(rightTarget)) {
                const leftContent = fs.readFileSync(leftTarget, 'utf-8');

                var sensorObj: any = JSON.parse(leftContent);
                exportSensorObj.sensors.include.push(sensorObj.name);
            }
        });

        // make export call from left to get all sensors
        if (exportSensorObj.sensors.include.length !== 0)  {
            // make call
            console.log(JSON.stringify(exportSensorObj, null, 2));
        }

        // write out file
    }

    public static async processSensors(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerSensorInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdnString;
        const leftUsername: string = state.leftUsernameString;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdnString;
        const rightUsername: string = state.rightUsernameString;
        const rightPassword: string = state.rightPassword;
        const extractCommentWhitespace: boolean = state.extractCommentWhitespace;

        const leftRestBase = `https://${leftFqdn}/api/v2`;
        const rightRestBase = `https://${rightFqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);
        OutputChannelLogging.log(`commentWhitespace: ${extractCommentWhitespace}`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}`);
        const commentDir = path.join(folderPath!, 'Comments Only');
        const commentLeftDir = path.join(commentDir, `1 - ${sanitize(leftFqdn)}`);
        const commentRightDir = path.join(commentDir, `1 - ${sanitize(rightFqdn)}`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        if (extractCommentWhitespace) {
            if (!fs.existsSync(commentDir)) {
                fs.mkdirSync(commentDir);
            }

            if (!fs.existsSync(commentLeftDir)) {
                fs.mkdirSync(commentLeftDir);
            }

            if (!fs.existsSync(commentRightDir)) {
                fs.mkdirSync(commentRightDir);
            }
        }

        // get left sensors
        // get session
        var leftSession: string;
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                json: {
                    username: leftUsername,
                    password: leftPassword,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.post(`${leftRestBase}/session/login`, options);

            leftSession = body.data.session;
        } catch (err) {
            OutputChannelLogging.logError('could not retrieve left session', err);
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `sensor retrieval from ${leftFqdn}`,
            cancellable: true
        }, (progress, token) => {
            token.onCancellationRequested(() => {
                OutputChannelLogging.log(`sensor retrieval from ${leftFqdn} cancelled`);
            });

            const p = new Promise(resolve => {
                progress.report({ increment: 0 });

                try {
                    (async () => {
                        const options = wrapOption(allowSelfSignedCerts, {
                            headers: {
                                session: leftSession,
                            },
                            responseType: 'json',
                            timeout: httpTimeout,
                        });

                        const { body } = await got.get(`${leftRestBase}/sensors`, options);

                        const leftSensors: [any] = body.data;
                        const leftSensorTotal = leftSensors.length - 1;
                        const leftSensorIncrement = 100 / leftSensorTotal;
                        var leftSensorCounter = 0;

                        for (var i = 0; i < leftSensors.length - 1; i++) {
                            const sensor: any = leftSensors[i];

                            const leftSensorName: string = sanitize(sensor.name);

                            try {
                                const transformedSensor = TransformSensor.transform(sensor);
                                const content: string = JSON.stringify(transformedSensor, null, 2);

                                const leftFile = path.join(leftDir, leftSensorName + '.json');
                                fs.writeFile(leftFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${leftFile}`, err);
                                    }

                                    leftSensorCounter++;
                                    progress.report({
                                        increment: leftSensorCounter * leftSensorIncrement
                                    });

                                    if (leftSensorTotal === leftSensorCounter) {
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing left sensor ${leftSensorName}`, err);

                                leftSensorCounter++;
                                progress.report({
                                    increment: leftSensorCounter * leftSensorIncrement
                                });

                                if (leftSensorTotal === leftSensorCounter) {
                                    resolve();
                                }
                            }
                        }
                    })();
                } catch (err) {
                    OutputChannelLogging.logError(`error downloading sensors from ${leftFqdn}`, err);
                }
            });

            return p;
        });

        // get right sensors
        // get session
        var rightSession: string;
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                https: {
                    rejectUnauthorized: false
                },
                json: {
                    username: rightUsername,
                    password: rightPassword,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.post(`${rightRestBase}/session/login`, options);

            rightSession = body.data.session;
        } catch (err) {
            OutputChannelLogging.logError('could not retrieve right session', err);
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `sensor retrieval from ${rightFqdn}`,
            cancellable: true
        }, (progress, token) => {
            token.onCancellationRequested(() => {
                OutputChannelLogging.log(`sensor retrieval from ${rightFqdn} cancelled`);
            });

            const p = new Promise(resolve => {
                progress.report({ increment: 0 });

                try {
                    (async () => {
                        const options = wrapOption(allowSelfSignedCerts, {
                            headers: {
                                session: rightSession,
                            },
                            responseType: 'json',
                            timeout: httpTimeout,
                        });

                        const { body } = await got.get(`${rightRestBase}/sensors`, options);

                        const rightSensors: [any] = body.data;
                        const rightSensorTotal = rightSensors.length - 1;
                        const rightSensorIncrement = 100 / rightSensorTotal;
                        var rightSensorCounter = 0;

                        for (var i = 0; i < rightSensors.length - 1; i++) {
                            const sensor = rightSensors[i];
                            const rightSensorName: string = sanitize(sensor.name);

                            try {
                                const transformedSensor = TransformSensor.transform(sensor);
                                const content: string = JSON.stringify(transformedSensor, null, 2);

                                const rightFile = path.join(rightDir, rightSensorName + '.json');
                                fs.writeFile(rightFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${rightFile}`, err);
                                    }

                                    rightSensorCounter++;
                                    progress.report({
                                        increment: rightSensorCounter * rightSensorIncrement
                                    });

                                    if (rightSensorTotal === rightSensorCounter) {
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing left sensor ${rightSensorName}`, err);

                                rightSensorCounter++;
                                progress.report({
                                    increment: rightSensorCounter * rightSensorIncrement
                                });

                                if (rightSensorTotal === rightSensorCounter) {
                                    resolve();
                                }
                            }
                        }
                    })();
                } catch (err) {
                    OutputChannelLogging.logError(`error downloading sensors from ${rightFqdn}`, err);
                }
            });

            return p;
        });

        if (extractCommentWhitespace) {
            var files: string[];
            setTimeout(async () => {
                files = fs.readdirSync(leftDir);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Extracting sensors with comments/whitspaces changes only',
                    cancellable: true
                }, (progress, token) => {
                    token.onCancellationRequested(() => {
                        OutputChannelLogging.log('Extracting sensors with comments/whitspaces changes only');
                    });

                    const fileTotal = files.length;
                    const fileIncrement = 100 / fileTotal;

                    var fileCounter = 0;

                    const p = new Promise(resolve => {
                        progress.report({ increment: 0 });
                        files.forEach(file => {
                            try {
                                // check files
                                const leftTarget = path.join(leftDir, file);
                                const rightTarget = leftTarget.replace(leftDir, rightDir);
                                if (fs.existsSync(rightTarget)) {
                                    // read contents of each file
                                    const leftContent = fs.readFileSync(leftTarget, 'utf-8');
                                    const rightContent = fs.readFileSync(rightTarget, 'utf-8');

                                    // do diff
                                    const dmp = new diffMatchPatch();
                                    const diffs = dmp.diff_main(leftContent, rightContent);
                                    dmp.diff_cleanupSemantic(diffs);

                                    var onlyComments = true;
                                    var allEqual = true;

                                    diffs.forEach((diff: any) => {
                                        const operation: number = diff[0];
                                        const text: string = diff[1];

                                        if (operation !== diffMatchPatch.DIFF_EQUAL) {
                                            allEqual = false;

                                            // trim text
                                            var test = text.trim();

                                            if (test.length !== 0) {
                                                var first = test.substr(0, 1);
                                                if (first === '"') {
                                                    first = test.substr(1, 1);
                                                }

                                                if (first !== '#' && first !== "'" && first !== ',') {
                                                    onlyComments = false;
                                                }
                                            }
                                        }
                                    });

                                    if (onlyComments && !allEqual) {
                                        // move the files
                                        fs.renameSync(leftTarget, path.join(commentLeftDir, file));
                                        fs.renameSync(rightTarget, path.join(commentRightDir, file));
                                    }
                                }

                                fileCounter++;
                                progress.report({
                                    increment: fileCounter * fileIncrement
                                });

                                if (fileTotal === fileCounter) {
                                    resolve();
                                }
                            } catch (err) {
                                OutputChannelLogging.logError('error comparing files', err);

                                fileCounter++;
                                progress.report({
                                    increment: fileCounter * fileIncrement
                                });

                                if (fileTotal === fileCounter) {
                                    resolve();
                                }
                            }
                        });
                    });

                    return p;
                });
            }, 1000);
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Processing Complete!",
            cancellable: false
        }, (progress, token) => {
            progress.report({
                increment: 100,
                message: 'Processing is complete',
            });

            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 5000);
            });

            return p;
        });
    }
}