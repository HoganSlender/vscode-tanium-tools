/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { ContentSets } from './ContentSets';
import { collectServerServerContentSetInputs } from '../parameter-collection/server-server-content-sets-parameters';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSets': () => {
            ServerServerContentSets.processContentSets(context);
        },
    });
}

export class ServerServerContentSets {
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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%ContentSets`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%ContentSets`);

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
                    var contentSetTotal = content_sets.length;
                    for (var i = 0; i < content_sets.length; i++) {
                        const contentSet: any = content_sets[i];

                        if (i % 30 === 0 || i === contentSetTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${contentSetTotal}`);
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

    static retrieveContentSetMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise((resolve, reject) => {
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
                    for (var i = 0; i < content_sets.length; i++) {
                        const contentSet = content_sets[i];
                        contentSets[contentSet.id] = contentSet.name;
                    }

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
