/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetRoleInputs } from '../parameter-collection/server-server-content-set-roles-parameters';
import { ContentSetRoles } from './ContentSetRoles';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { PathUtils } from '../common/pathUtils';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetRoles': () => {
            ServerServerContentSetRoles.processContentSetRoles(context);
        }
    });
}

export class ServerServerContentSetRoles extends ServerServerBase {
    static async processContentSetRoles(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerContentSetRoleInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%ContentSetRoles`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%ContentSetRoles`);

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

            progress.report({ increment: increment, message: `content set role retrieval from ${leftFqdn.label}` });
            await this.processServerContentSetRoles(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set role retrieval from ${rightFqdn.label}` });
            await this.processServerContentSetRoles(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
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
            label: 'Content Set Roles',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeContentSetRoles',
        }, context);

        ContentSetRoles.analyzeContentSetRoles(diffItems, context);
    }

    static processServerContentSetRoles(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`content set role retrieval - initialized for ${fqdn.label}`);
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

                        OutputChannelLogging.log(`content set role retrieval - complete for ${fqdn.label}`);
                        content_set_roles = body.data.object_list.content_set_roles;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set roles from ${fqdn.label}`, err);
                        return reject(`retrieving content_set_roles from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var contentSetRoleCounter: number = 0;
                    var contentSetRoleTotal: number = content_set_roles.length;

                    if (contentSetRoleTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content set roles for ${fqdn.label}`);
                        resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({
                                increment: 0
                            });

                            const innerIncrement = 100 / content_set_roles.length;

                            for (var i = 0; i < content_set_roles.length; i++) {
                                const contentSetRole = content_set_roles[i];

                                innerProgress.report({
                                    increment: innerIncrement,
                                    message: `${i + 1}/${content_set_roles.length}: ${contentSetRole.name}`
                                });

                                if (contentSetRole.deleted_flag === 1) {
                                    if (checkResolve(++contentSetRoleCounter, contentSetRoleTotal, 'content set roles', fqdn)) {
                                        return resolve();
                                    }
                                } else {
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

                                                if (checkResolve(++contentSetRoleCounter, contentSetRoleTotal, 'content set roles', fqdn)) {
                                                    return resolve();
                                                }
                                            });
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} content set roles ${contentSetRoleName}`, err);

                                            if (checkResolve(++contentSetRoleCounter, contentSetRoleTotal, 'content set roles', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`saving content set role file for ${contentSetRole.name} from ${fqdn.label}`, err);

                                        if (checkResolve(++contentSetRoleCounter, contentSetRoleTotal, 'content set roles', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }
                        });
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
        const p = new Promise<any>((resolve, reject) => {
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
                    content_set_roles.forEach(contentSetRole => {
                        contentSetRoles[contentSetRole.id] = contentSetRole.name;
                    });

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