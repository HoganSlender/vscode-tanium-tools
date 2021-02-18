/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetInputs } from '../parameter-collection/server-server-content-sets-parameters';
import { ContentSets } from './ContentSets';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { PathUtils } from '../common/pathUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSets': () => {
            ServerServerContentSets.processContentSets(context);
        },
    });
}

export class ServerServerContentSets extends ServerServerBase {
    static async processContentSets(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        if (this.invalidWorkspaceFolders()) {
            return;
        }

        // get the current folder
        const folderPath = vscode.workspace.workspaceFolders![0].uri.fsPath;

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetInputs(config, context);

        // collect values
        const leftFqdn: FqdnSetting = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: FqdnSetting = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;


        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn.label}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn.label}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: leftFqdn,
                username: leftUsername,
                password: leftPassword
            },
            {
                fqdn: rightFqdn,
                username: rightUsername,
                password: rightPassword
            }
        ])) {
            return;
        }

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%ContentSets`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%ContentSets`);

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

            progress.report({ increment: increment, message: `content set retrieval from ${leftFqdn.label}` });
            await this.processServerContentSets(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set retrieval from ${rightFqdn.label}` });
            await this.processServerContentSets(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Content Sets',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeContentSets',
        }, context);

        ContentSets.analyzeContentSets(diffItems, context);
    }

    static processServerContentSets(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`content set retrieval - initialized for ${fqdn.label}`);
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

                        OutputChannelLogging.log(`content set retrieval - complete for ${fqdn.label}`);
                        content_sets = body.data.object_list.content_sets;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content sets from ${fqdn.label}`, err);
                        return reject(`retrieving content_sets from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var contentSetCounter: number = 0;
                    var contentSetTotal: number = content_sets.length;

                    if (contentSetTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content sets for ${fqdn.label}`);
                        resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({
                                increment: 0
                            });

                            const innerIncrement = 100 / content_sets.length;

                            for (var i = 0; i < content_sets.length; i++) {
                                const contentSet = content_sets[i];

                                innerProgress.report({
                                    increment: innerIncrement,
                                    message: `${i + 1}/${content_sets.length}: ${contentSet.name}`
                                });

                                if (contentSet.deleted_flag === 1) {
                                    if (checkResolve(++contentSetCounter, contentSetTotal, 'content sets', fqdn)) {
                                        return resolve();
                                    }
                                } else {
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
                                            });

                                            if (checkResolve(++contentSetCounter, contentSetTotal, 'content sets', fqdn)) {
                                                return resolve();
                                            }
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} content set ${contentSetName}`, err);

                                            if (checkResolve(++contentSetCounter, contentSetTotal, 'content sets', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`saving content set file for ${contentSet.name} from ${fqdn.label}`, err);

                                        if (checkResolve(++contentSetCounter, contentSetTotal, 'content sets', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content sets from ${restBase}`, err);
                return reject(`error downloading content sets from ${restBase}`);
            }
        });

        return p;
    }

    static retrieveContentSetMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise<any>((resolve, reject) => {
            try {
                (async () => {
                    var contentSets: any = {};
                    var content_sets: [any];

                    // get content sets
                    try {
                        const body = await RestClient.get(`${restBase}/content_sets`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content sets retrieved`);
                        content_sets = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`error retrieving content sets`, err);
                        return reject();
                    }

                    // create map
                    content_sets.forEach(contentSet => {
                        contentSets[contentSet.id] = contentSet.name;
                    });

                    resolve(contentSets);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving content sets`, err);
                reject();
            }
        });

        return p;
    }
}
