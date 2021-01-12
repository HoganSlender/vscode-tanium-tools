/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerUsersInputs } from '../parameter-collection/server-server-users-parameters';
import { Groups } from './Groups';
import { Users } from './Users';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerUsers': () => {
            ServerServerUsers.processUsers(context);
        }
    });
}

class ServerServerUsers extends ServerServerBase {
    public static async processUsers(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerUsersInputs(config, context);

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

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%Users`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%Users`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'User Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `user retrieval from ${leftFqdn.label}` });
            await this.processServerUsers(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `user retrieval from ${rightFqdn.label}` });
            await this.processServerUsers(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        Users.analyzeUsers(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerUsers(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`user retrieval - initialized for ${fqdn.label}`);
                    var users: [any];

                    // get users
                    try {
                        const body = await RestClient.get(`${restBase}/users`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`user retrieval - complete for ${fqdn.label}`);
                        users = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving users from ${fqdn.label}`, err);
                        return reject(`retrieving content_set_privileges from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var userCounter: number = 0;
                    var userTotal: number = users.length;

                    if (userTotal === 0) {
                        OutputChannelLogging.log(`there are 0 users for ${fqdn.label}`);
                        resolve();
                    } else {
                        // get groups map
                        const groupMap = await Groups.getGroupMapById(allowSelfSignedCerts, httpTimeout, restBase, session);

                        for (var i = 0; i < users.length; i++) {
                            const user = users[i];

                            if (i % 30 === 0 || i === userTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${userTotal}`);
                            }

                            if (user.deleted_flag || user.locked_out !== 0) {
                                if (checkResolve(++userCounter, userTotal, 'users', fqdn)) {
                                    return resolve();
                                }
                            } else {
                                // get export
                                try {
                                    const userName: string = sanitize(user.display_name.trim().length === 0 ? user.name : user.display_name);

                                    try {
                                        const anonymizedUser = await Users.anonymizeUser(user, groupMap);
                                        const content: string = JSON.stringify(anonymizedUser, null, 2);

                                        const userFile = path.join(directory, userName + '.json');
                                        fs.writeFile(userFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${userFile}`, err);
                                            }

                                            if (checkResolve(++userCounter, userTotal, 'users', fqdn)) {
                                                return resolve();
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} user ${userName}`, err);

                                        if (checkResolve(++userCounter, userTotal, 'users', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`saving user file for ${user.name} from ${fqdn.label}`, err);

                                    if (checkResolve(++userCounter, userTotal, 'users', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading users from ${restBase}`, err);
                return reject(`error downloading users from ${restBase}`);
            }
        });

        return p;
    }
}