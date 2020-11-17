/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import { collectServerServerSensorInputs } from '../parameter-collection/server-server-sensors-parameters';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { TransformSensor } from '../transform/transform-sensor';
import { collectServerServerMissingSensorInputs } from '../parameter-collection/server-server-missing-sensors-parameters';
import { collectServerServerModifiedSensorInputs } from '../parameter-collection/server-server-modified-sensors-parameters';
import { collectServerServerPackageInputs } from '../parameter-collection/server-server-package-parameters';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { Packages } from './Packages';
import { ContentSets } from './ContentSets';
import { ContentSetPrivileges } from './ContentSetPrivileges';
import { collectServerServerContentSetInputs } from '../parameter-collection/server-server-content-sets-parameters';
import { collectServerServerContentSetPrivilegeInputs } from '../parameter-collection/server-server-content-set-privileges-parameters';

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
        },
        'hoganslendertanium.compareServerServerPackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServer.processPackages(context);
        },
        'hoganslendertanium.compareServerServerContentSets': () => {
            ServerServer.processContentSets(context);
        },
        'hoganslendertanium.compareServerServerContentSetPrivileges': () => {
            ServerServer.processContentSetPrivileges(context);
        }
    });
}

class ServerServer {
    static async processPackages(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerPackageInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Package Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `package retrieval from ${leftFqdn}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `package retrieval from ${rightFqdn}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze packages
        Packages.analyzePackages(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerContentSetPrivileges(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`content set privilege retrieval - initialized for ${fqdn}`);
                    var content_set_privileges: [any];

                    // get packages
                    try {
                        const body = await RestClient.post(`${restBase}/export`, {
                            headers: {
                                session: session,
                            },
                            json: {
                                "content_set_privileges": {
                                    "include_all": true,
                                }
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set privilege retrieval - complete for ${fqdn}`);
                        content_set_privileges = body.data.object_list.content_set_privileges;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set privileges from ${fqdn}`, err);
                        return reject(`retrieving content_set_privileges from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetPrivilegeCounter = 0;
                    var contentSetPrivilegeTotal = content_set_privileges.length - 1;
                    for (var i = 0; i < content_set_privileges.length; i++) {
                        const contentSetPrivilege: any = content_set_privileges[i];

                        if (i % 30 === 0 || i === contentSetPrivilegeTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${contentSetPrivilegeTotal}`);
                        }

                        if (contentSetPrivilege?.content_set?.name === 'Reserved') {
                            contentSetPrivilegeCounter++;

                            if (contentSetPrivilegeTotal === contentSetPrivilegeCounter) {
                                OutputChannelLogging.log(`processed ${contentSetPrivilegeTotal} content set privileges from ${fqdn}`);
                                resolve();
                            }
                        }

                        // get export
                        try {
                            const contentSetPrivilegeName: string = sanitize(contentSetPrivilege.name);

                            try {
                                const content: string = JSON.stringify(contentSetPrivilege, null, 2);

                                const contentSetPrivilegeFile = path.join(directory, contentSetPrivilegeName + '.json');
                                fs.writeFile(contentSetPrivilegeFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${contentSetPrivilegeFile}`, err);
                                    }

                                    contentSetPrivilegeCounter++;

                                    if (contentSetPrivilegeTotal === contentSetPrivilegeCounter) {
                                        OutputChannelLogging.log(`processed ${contentSetPrivilegeTotal} content set privileges from ${fqdn}`);
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing ${label} content set privilege ${contentSetPrivilegeName}`, err);
                                contentSetPrivilegeCounter++;

                                if (contentSetPrivilegeTotal === contentSetPrivilegeCounter) {
                                    OutputChannelLogging.log(`processed ${contentSetPrivilegeTotal} content set privilege from ${fqdn}`);
                                    resolve();
                                }
                            }
                        } catch (err) {
                            OutputChannelLogging.logError(`saving content set privilege file for ${contentSetPrivilege.name} from ${fqdn}`, err);
                            contentSetPrivilegeCounter++;

                            if (contentSetPrivilegeTotal === contentSetPrivilegeCounter) {
                                OutputChannelLogging.log(`processed ${contentSetPrivilegeTotal} content sets from ${fqdn}`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content set privileges from ${restBase}`, err);
                return reject(`error downloading content set privileges from ${restBase}`);
            }
        });

        return p;
    }

    static processServerContentSets(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`content set retrieval - initialized for ${fqdn}`);
                    var content_sets: [any];

                    // get packages
                    try {
                        const body = await RestClient.post(`${restBase}/export`, {
                            headers: {
                                session: session,
                            },
                            json: {
                                "content_sets": {
                                    "include_all": true,
                                }
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set retrieval - complete for ${fqdn}`);
                        content_sets = body.data.object_list.content_sets;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content sets from ${fqdn}`, err);
                        return reject(`retrieving content_sets from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetCounter = 0;
                    var contentSetTotal = content_sets.length - 1;
                    for (var i = 0; i < content_sets.length; i++) {
                        const contentSet: any = content_sets[i];

                        if (i % 30 === 0 || i === contentSetTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${contentSetTotal}`);
                        }

                        if (contentSet?.content_set?.name === 'Reserved') {
                            contentSetCounter++;

                            if (contentSetTotal === contentSetCounter) {
                                OutputChannelLogging.log(`processed ${contentSetTotal} packages from ${fqdn}`);
                                resolve();
                            }
                        }

                        // get export
                        try {
                            const contentSetName: string = sanitize(contentSet.name);

                            try {
                                const content: string = JSON.stringify(contentSet, null, 2);

                                const contentSetFile = path.join(directory, contentSetName + '.json');
                                fs.writeFile(contentSetFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${contentSetFile}`, err);
                                    }

                                    contentSetCounter++;

                                    if (contentSetTotal === contentSetCounter) {
                                        OutputChannelLogging.log(`processed ${contentSetTotal} content sets from ${fqdn}`);
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing ${label} content set ${contentSetName}`, err);
                                contentSetCounter++;

                                if (contentSetTotal === contentSetCounter) {
                                    OutputChannelLogging.log(`processed ${contentSetTotal} content set from ${fqdn}`);
                                    resolve();
                                }
                            }
                        } catch (err) {
                            OutputChannelLogging.logError(`saving content set file for ${contentSet.name} from ${fqdn}`, err);
                            contentSetCounter++;

                            if (contentSetTotal === contentSetCounter) {
                                OutputChannelLogging.log(`processed ${contentSetTotal} content sets from ${fqdn}`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content sets from ${restBase}`, err);
                return reject(`error downloading content sets from ${restBase}`);
            }
        });

        return p;
    }

    static processServerPackages(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`package retrieval - initialized for ${fqdn}`);
                    var package_specs: [any];

                    // get packages
                    try {
                        const body = await RestClient.get(`${restBase}/packages`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`package_spec retrieval - complete for ${fqdn}`);
                        package_specs = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving package_specs from ${fqdn}`, err);
                        return reject(`retrieving package_specs from ${fqdn}`);
                    }

                    // iterate through each download export
                    var packageSpecCounter = 0;
                    var packageSpecTotal = package_specs.length - 1;
                    for (var i = 0; i < package_specs.length - 1; i++) {
                        const packageSpec: any = package_specs[i];

                        if (i % 30 === 0 || i === packageSpecTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${packageSpecTotal}`);
                        }

                        if (packageSpec?.content_set?.name === 'Reserved') {
                            packageSpecCounter++;

                            if (packageSpecTotal === packageSpecCounter) {
                                OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                resolve();
                            }
                        }

                        // get export
                        try {
                            const body = await RestClient.post(`${restBase}/export`, {
                                headers: {
                                    session: session,
                                },
                                json: {
                                    package_specs: {
                                        include: [
                                            packageSpec.name
                                        ]
                                    }
                                },
                                responseType: 'json',
                            }, allowSelfSignedCerts, httpTimeout);

                            const taniumPackage: any = body.data.object_list.package_specs[0];
                            const packageName: string = sanitize(taniumPackage.name);

                            try {
                                const content: string = JSON.stringify(body.data.object_list, null, 2);

                                const packageFile = path.join(directory, packageName + '.json');
                                fs.writeFile(packageFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${packageFile}`, err);
                                    }

                                    packageSpecCounter++;

                                    if (packageSpecTotal === packageSpecCounter) {
                                        OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing ${label} package ${packageName}`, err);
                                packageSpecCounter++;

                                if (packageSpecTotal === packageSpecCounter) {
                                    OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                    resolve();
                                }
                            }
                        } catch (err) {
                            OutputChannelLogging.logError(`retrieving packageExport for ${packageSpec.name} from ${fqdn}`, err);
                            packageSpecCounter++;

                            if (packageSpecTotal === packageSpecCounter) {
                                OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading packages from ${restBase}`, err);
                return reject(`error downloading packages from ${restBase}`);
            }
        });

        return p;
    }

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

            var leftSession: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);

            // get export output
            OutputChannelLogging.log(`retrieving export data from ${leftFqdn}`);
            try {
                const body = await RestClient.post(`${leftRestBase}/export`, {
                    headers: {
                        session: leftSession,
                    },
                    json: exportSensorObj,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);
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

            var leftSession: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);
            try {
                const body = await RestClient.post(`${leftRestBase}/session/login`, {
                    json: {
                        username: leftUsername,
                        password: leftPassword,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                leftSession = body.data.session;
            } catch (err) {
                OutputChannelLogging.logError('could not retrieve left session', err);
                return;
            }

            // get export output
            OutputChannelLogging.log(`retrieving export data from ${leftFqdn}`);
            try {
                const body = await RestClient.post(`${leftRestBase}/export`, {
                    headers: {
                        session: leftSession,
                    },
                    json: exportSensorObj,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);
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

    static async processContentSetPrivileges(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetPrivilegeInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)} - Content Sets`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)} - Content Sets`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Content Set Privilege Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `content set privilege retrieval from ${leftFqdn}` });
            await this.processServerContentSetPrivileges(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set privilege retrieval from ${rightFqdn}` });
            await this.processServerContentSetPrivileges(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSetPrivileges.analyzeContentSetPrivileges(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static async processContentSets(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;


        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)} - Content Sets`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)} - Content Sets`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Content Set Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `content set retrieval from ${leftFqdn}` });
            await this.processServerContentSets(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set retrieval from ${rightFqdn}` });
            await this.processServerContentSets(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSets.analyzeContentSets(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
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
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
                progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
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
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
                progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn}` });
                await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
                const p = new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 3000);
                });

                return p;
            }
        });
    }

    static processServerSensors(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const p = new Promise(async resolve => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    const body = await RestClient.get(`https://${fqdn}/api/v2/sensors`, {
                        headers: {
                            session: session,
                        },
                        responseType: 'json',
                    }, allowSelfSignedCerts, httpTimeout);

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
                OutputChannelLogging.logError(`error downloading sensors from ${fqdn}`, err);
            }
        });

        return p;
    }

    static extractCommentWhitespaceSensors(leftDir: string, rightDir: string, commentLeftDir: string, commentRightDir: string) {
        const p = new Promise(resolve => {
            var files: string[];
            files = fs.readdirSync(leftDir);

            const fileTotal = files.length;

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