/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { ContentSetPrivileges } from './ContentSetPrivileges';
import { collectServerServerContentSetPrivilegeInputs } from '../parameter-collection/server-server-content-set-privileges-parameters';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetPrivileges': () => {
            ServerServerContentSetPrivileges.processContentSetPrivileges(context);
        }
    });
}

export class ServerServerContentSetPrivileges {
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
                    var contentSetPrivilegeTotal = content_set_privileges.length;
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

    static retrieveContentSetPrivilegeMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise((resolve, reject) => {
            try {
                (async () => {
                    var contentSetPrivileges: any = {};
                    var content_set_privileges: [any];

                    // get content set privileges
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_privileges`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set privileges retrieved`);
                        content_set_privileges = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`error retrieving content set privileges`, err);
                        return reject();
                    }

                    // create map
                    for (var i = 0; i < content_set_privileges.length; i++) {
                        const contentSetPrivilege = content_set_privileges[i];
                        contentSetPrivileges[contentSetPrivilege.id] = contentSetPrivilege.name;
                    }

                    resolve(contentSetPrivileges);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving content set roles`, err);
                reject();
            }
        });

        return p;
    }
}