/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { collectServerServerContentSetRoleInputs } from '../parameter-collection/server-server-content-set-roles-parameters';
import { ContentSetRoles } from './ContentSetRoles';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetRoles': () => {
            ServerServerContentSetRoles.processContentSetRoles(context);
        }
    });
}

export class ServerServerContentSetRoles {
    static async processContentSetRoles(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetRoleInputs(config, context);

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
            title: 'Content Set Role Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `content set role retrieval from ${leftFqdn}` });
            await this.processServerContentSetRoles(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set role retrieval from ${rightFqdn}` });
            await this.processServerContentSetRoles(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSetRoles.analyzeContentSetRoles(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerContentSetRoles(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`content set role retrieval - initialized for ${fqdn}`);
                    var content_set_roles: [any];

                    // get packages
                    try {
                        const body = await RestClient.post(`${restBase}/export`, {
                            headers: {
                                session: session,
                            },
                            json: {
                                "content_set_roles": {
                                    "include_all": true,
                                }
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set role retrieval - complete for ${fqdn}`);
                        content_set_roles = body.data.object_list.content_set_roles;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set roles from ${fqdn}`, err);
                        return reject(`retrieving content_set_roles from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetRoleCounter = 0;
                    var contentSetRoleTotal = content_set_roles.length;
                    for (var i = 0; i < content_set_roles.length; i++) {
                        const contentSetRole: any = content_set_roles[i];

                        if (i % 30 === 0 || i === contentSetRoleTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${contentSetRoleTotal}`);
                        }

                        if (contentSetRole?.content_set?.name === 'Reserved') {
                            contentSetRoleCounter++;

                            if (contentSetRoleTotal === contentSetRoleCounter) {
                                OutputChannelLogging.log(`processed ${contentSetRoleTotal} content set roles from ${fqdn}`);
                                resolve();
                            }
                        }

                        // get export
                        try {
                            const contentSetRoleName: string = sanitize(contentSetRole.name);

                            try {
                                const content: string = JSON.stringify(contentSetRole, null, 2);

                                const contentSetRoleFile = path.join(directory, contentSetRoleName + '.json');
                                fs.writeFile(contentSetRoleFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${contentSetRoleFile}`, err);
                                    }

                                    contentSetRoleCounter++;

                                    if (contentSetRoleTotal === contentSetRoleCounter) {
                                        OutputChannelLogging.log(`processed ${contentSetRoleTotal} content set roles from ${fqdn}`);
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing ${label} content set roles ${contentSetRoleName}`, err);
                                contentSetRoleCounter++;

                                if (contentSetRoleTotal === contentSetRoleCounter) {
                                    OutputChannelLogging.log(`processed ${contentSetRoleTotal} content set role from ${fqdn}`);
                                    resolve();
                                }
                            }
                        } catch (err) {
                            OutputChannelLogging.logError(`saving content set role file for ${contentSetRole.name} from ${fqdn}`, err);
                            contentSetRoleCounter++;

                            if (contentSetRoleTotal === contentSetRoleCounter) {
                                OutputChannelLogging.log(`processed ${contentSetRoleTotal} content set roles from ${fqdn}`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content set roles from ${restBase}`, err);
                return reject(`error downloading content set roles from ${restBase}`);
            }
        });

        return p;
    }

    static retrieveContentSetRoleMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise((resolve, reject) => {
            try {
                (async () => {
                    var contentSetRoles: any = {};
                    var content_set_roles: [any];

                    // get content set roles
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_roles`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set roles retrieved`);
                        content_set_roles = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`error retrieving content set roles`, err);
                        return reject();
                    }

                    // create map
                    for (var i = 0; i < content_set_roles.length; i++) {
                        const contentSetRole = content_set_roles[i];
                        contentSetRoles[contentSetRole.id] = contentSetRole.name;
                    }

                    resolve(contentSetRoles);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving content set roles`, err);
                reject();
            }
        });

        return p;
    }
}