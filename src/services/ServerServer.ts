import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import { collectServerServerSensorInputs } from '../parameter-collection/server-server-sensors-parameters';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
const got = require('got');
import { TransformSensor } from '../transform/transform-sensor';
import { wrapOption } from '../common/requestOption';
import { collectServerServerMissingSensorInputs } from '../parameter-collection/server-server-missing-sensors-parameters';
import { collectServerServerModifiedSensorInputs } from '../parameter-collection/server-server-modified-sensors-parameters';

const diffMatchPatch = require('diff-match-patch');

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSensors': () => {
            ServerServer.processSensors(context);
        },
        'hoganslendertanium.generateExportFileMissingSensors': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServer.processMissingSensors(uris[0], uris[1], context);
        },
        'hoganslendertanium.generateExportFileModifiedSensors': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServer.processModifiedSensors(uris[0], uris[1], context);
        }
    });
}

class ServerServer {
    public static async processModifiedSensors(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerModifiedSensorInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;

        const leftRestBase = `https://${leftFqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);

        const leftDir = left.fsPath;
        const rightDir = right.fsPath;

        // go through files on left and see if it exists on right
        const files: string[] = fs.readdirSync(leftDir);

        const exportSensorObj: any = {
            sensors: {
                include: []
            }
        };

        OutputChannelLogging.log('retrieving sensors');
        files.forEach(file => {
            try {
                const leftTarget = path.join(leftDir, file);
                const rightTarget = leftTarget.replace(leftDir, rightDir);

                if (fs.existsSync(rightTarget)) {
                    const leftContent = fs.readFileSync(leftTarget, 'utf-8');
                    const rightContent = fs.readFileSync(rightTarget, 'utf-8');

                    const dmp = new diffMatchPatch();
                    const diffs = dmp.diff_main(leftContent, rightContent);
                    dmp.diff_cleanupSemantic(diffs);

                    var different = false;
                    diffs.forEach((diff: any) => {
                        if (!different && !(diff[0] === diffMatchPatch.DIFF_EQUAL)) {
                            different = true;
                        }
                    });

                    if (different) {
                        var sensorObj: any = JSON.parse(leftContent);
                        exportSensorObj.sensors.include.push(sensorObj.name);
                    }
                }
            } catch (err) {
                OutputChannelLogging.logError('error calculating diffs', err);
            }
        });
        OutputChannelLogging.log('sensors retrieved');

        // make export call from left to get all sensors
        if (exportSensorObj.sensors.include.length !== 0) {
            OutputChannelLogging.log(`exporting ${exportSensorObj.sensors.include.length} sensors from ${leftFqdn}`);
            OutputChannelLogging.log(`retrieving session`);

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

            // get export output
            OutputChannelLogging.log(`retrieving export data from ${leftFqdn}`);
            try {
                const options = wrapOption(allowSelfSignedCerts, {
                    headers: {
                        session: leftSession,
                    },
                    json: exportSensorObj,
                    responseType: 'json',
                    timeout: httpTimeout,
                });

                const { body } = await got.post(`${leftRestBase}/export`, options);
                OutputChannelLogging.log(`export data retrieved`);

                const exportContent = JSON.stringify(body.data, null, 2);

                // write out file
                OutputChannelLogging.log(`writing file ModifiedObjects.json`);
                fs.writeFile(path.join(folderPath!, 'ModifiedObjects.json'), exportContent, (err) => {
                    if (err) {
                        OutputChannelLogging.logError('could not write ModifiedObjects.json', err);
                    }

                    OutputChannelLogging.log(`file written`);
                });
            } catch (err) {
                OutputChannelLogging.logError('error retrieving export data', err);
            }
        } else {
            OutputChannelLogging.log(`no sensors were found`);
        }
    }

    public static async processMissingSensors(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerMissingSensorInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;

        const leftRestBase = `https://${leftFqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);

        const leftDir = left.fsPath;
        const rightDir = right.fsPath;

        // go through files on left and see if it exists on right
        const files: string[] = fs.readdirSync(leftDir);

        const exportSensorObj: any = {
            sensors: {
                include: []
            }
        };

        OutputChannelLogging.log('retrieving sensors');
        files.forEach(file => {
            const leftTarget = path.join(leftDir, file);
            const rightTarget = leftTarget.replace(leftDir, rightDir);

            if (!fs.existsSync(rightTarget)) {
                const leftContent = fs.readFileSync(leftTarget, 'utf-8');

                var sensorObj: any = JSON.parse(leftContent);
                exportSensorObj.sensors.include.push(sensorObj.name);
            }
        });
        OutputChannelLogging.log('sensors retrieved');

        // make export call from left to get all sensors
        if (exportSensorObj.sensors.include.length !== 0) {
            OutputChannelLogging.log(`exporting ${exportSensorObj.sensors.include.length} sensors from ${leftFqdn}`);
            OutputChannelLogging.log(`retrieving session`);

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

            // get export output
            OutputChannelLogging.log(`retrieving export data from ${leftFqdn}`);
            try {
                const options = wrapOption(allowSelfSignedCerts, {
                    headers: {
                        session: leftSession,
                    },
                    json: exportSensorObj,
                    responseType: 'json',
                    timeout: httpTimeout,
                });

                const { body } = await got.post(`${leftRestBase}/export`, options);
                OutputChannelLogging.log(`export data retrieved`);

                const exportContent = JSON.stringify(body.data, null, 2);

                // write out file
                OutputChannelLogging.log(`writing file AddObjects.json`);
                fs.writeFile(path.join(folderPath!, 'AddObjects.json'), exportContent, (err) => {
                    if (err) {
                        OutputChannelLogging.logError('could not write AddObjects.json', err);
                    }

                    OutputChannelLogging.log(`file written`);
                });
            } catch (err) {
                OutputChannelLogging.logError('error retrieving export data', err);
            }
        } else {
            OutputChannelLogging.log(`no sensors were found`);
        }
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
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;
        const extractCommentWhitespaceBoolean: boolean = state.extractCommentWhitespace;

        const leftRestBase = `https://${leftFqdn}/api/v2`;
        const rightRestBase = `https://${rightFqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);
        OutputChannelLogging.log(`commentWhitespace: ${extractCommentWhitespaceBoolean.toString()}`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}`);
        const commentDir = path.join(folderPath!, 'Comments Only');
        const commentLeftDir = path.join(commentDir, `1 - ${sanitize(leftFqdn)}`);
        const commentRightDir = path.join(commentDir, `2 - ${sanitize(rightFqdn)}`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        if (extractCommentWhitespaceBoolean) {
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

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Sensor Compare',
            cancellable: false
        }, async (progress, token) => {
            progress.report({ increment: 0 });

            const increment = extractCommentWhitespaceBoolean ? 33 : 50;

            if (extractCommentWhitespaceBoolean) {
                progress.report({ increment: increment, message: `sensor retrieval from ${leftFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftRestBase, leftUsername, leftPassword, leftDir, 'left');
                progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightRestBase, rightUsername, rightPassword, rightDir, 'right');
                progress.report({ increment: increment, message: 'extracting comments/whitespace only differences' });
                this.extractCommentWhitespaceSensors(leftDir, rightDir, commentLeftDir, commentRightDir);
                const p = new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 3000);
                });

                return p;
            } else {
                progress.report({ increment: increment, message: `sensor retrieval from ${leftFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftRestBase, leftUsername, leftPassword, leftDir, 'left');
                progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightRestBase, rightUsername, rightPassword, rightDir, 'right');
                const p = new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 3000);
                });

                return p;
            }
        });
    }

    static processServerSensors(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, username: string, password: string, directory: string, label: string) {
        const p = new Promise(async resolve => {
            try {
                // get session
                var session: string;
                try {
                    const options = wrapOption(allowSelfSignedCerts, {
                        json: {
                            username: username,
                            password: password,
                        },
                        responseType: 'json',
                        timeout: httpTimeout,
                    });

                    const { body } = await got.post(`${restBase}/session/login`, options);

                    session = body.data.session;
                } catch (err) {
                    OutputChannelLogging.logError('could not retrieve left session', err);
                    return;
                }

                (async () => {
                    const options = wrapOption(allowSelfSignedCerts, {
                        headers: {
                            session: session,
                        },
                        responseType: 'json',
                        timeout: httpTimeout,
                    });

                    const { body } = await got.get(`${restBase}/sensors`, options);

                    const sensors: [any] = body.data;
                    const sensorTotal = sensors.length - 1;
                    var sensorCounter = 0;

                    for (var i = 0; i < sensors.length - 1; i++) {
                        const sensor: any = sensors[i];

                        if (sensor.category === 'Reserved') {
                            sensorCounter++;

                            if (sensorTotal === sensorCounter) {
                                OutputChannelLogging.log(`processed ${sensorTotal} sensors`);
                                resolve();
                            }
                            continue;
                        }

                        const sensorName: string = sanitize(sensor.name);

                        try {
                            const transformedSensor = TransformSensor.transform(sensor);
                            const content: string = JSON.stringify(transformedSensor, null, 2);

                            const sensorFile = path.join(directory, sensorName + '.json');
                            fs.writeFile(sensorFile, content, (err) => {
                                if (err) {
                                    OutputChannelLogging.logError(`could not write ${sensorFile}`, err);
                                }

                                sensorCounter++;

                                if (sensorTotal === sensorCounter) {
                                    OutputChannelLogging.log(`processed ${sensorTotal} sensors`);
                                    resolve();
                                }
                            });
                        } catch (err) {
                            OutputChannelLogging.logError(`error processing ${label} sensor ${sensorName}`, err);

                            sensorCounter++;

                            if (sensorTotal === sensorCounter) {
                                OutputChannelLogging.log(`processed ${sensorTotal} sensors`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading sensors from ${restBase}`, err);
            }
        });

        return p;
    }

    static extractCommentWhitespaceSensors(leftDir: string, rightDir: string, commentLeftDir: string, commentRightDir: string) {
        const p = new Promise(resolve => {
            var files: string[];
            files = fs.readdirSync(leftDir);

            const fileTotal = files.length;
            const fileIncrement = 100 / fileTotal;

            var fileCounter = 0;
            var commentsCounter = 0;

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
                                        // last check, strip " and ,
                                        test = test.replace(/\"/g, '').replace(/\,/g, '');
                                        if (test.length !== 0) {
                                            onlyComments = false;
                                        }
                                    }
                                }
                            }
                        });

                        if (onlyComments && !allEqual) {
                            commentsCounter++;

                            // move the files
                            fs.renameSync(leftTarget, path.join(commentLeftDir, file));
                            fs.renameSync(rightTarget, path.join(commentRightDir, file));
                        }
                    }

                    fileCounter++;

                    if (fileTotal === fileCounter) {
                        OutputChannelLogging.log(`${commentsCounter} whitespace/comments only`);
                    }
                } catch (err) {
                    OutputChannelLogging.logError('error comparing files', err);

                    fileCounter++;

                    if (fileTotal === fileCounter) {
                        OutputChannelLogging.log(`${commentsCounter} whitespace/comments only`);
                    }
                }
            });
        });

        return p;
    }
}