/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerUserGroupsInputs } from '../parameter-collection/server-server-user-groups-parameters';
import { Groups } from './Groups';
import { UserGroups } from './UserGroups';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerUserGroups': () => {
            ServerServerUserGroups.processUserGroups(context);
        }
    });
}

export class ServerServerUserGroups extends ServerServerBase {
    public static async processUserGroups(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerUserGroupsInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%UserGroups`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%UserGroups`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'User Group Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `user retrieval from ${leftFqdn}` });
            await this.processServerUserGroups(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `user retrieval from ${rightFqdn}` });
            await this.processServerUserGroups(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        UserGroups.analyzeUserGroups(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerUserGroups(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`user groups retrieval - initialized for ${fqdn}`);
                    var userGroups: [any];

                    // get usaers
                    try {
                        const body = await RestClient.get(`${restBase}/user_groups`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`user group retrieval - complete for ${fqdn}`);
                        userGroups = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving user groups from ${fqdn}`, err);
                        return reject(`retrieving user groups from ${fqdn}`);
                    }

                    // iterate through each download export
                    var userGroupCounter: number = 0;
                    var userGroupTotal: number = userGroups.length;

                    if (userGroupTotal === 0) {
                        OutputChannelLogging.log(`there are 0 user groups for ${fqdn}`);
                        resolve();
                    } else {
                        // get groups map
                        const groupMap = await Groups.getGroupMapById(allowSelfSignedCerts, httpTimeout, restBase, session);

                        var i = 0;

                        userGroups.forEach(async userGroup => {
                            i++;

                            if (i % 30 === 0 || i === userGroupTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${userGroupTotal}`);
                            }

                            if (userGroup.deleted_flag === 1) {
                                if (checkResolve(++userGroupCounter, userGroupTotal, 'user groups', fqdn)) {
                                    return resolve();
                                }
                            } else {
                                // get export
                                try {
                                    const userGroupName: string = sanitize(userGroup.name);

                                    try {
                                        const anonymizedUserGroup = await UserGroups.anonymizeUserGroup(userGroup, groupMap, restBase, session, allowSelfSignedCerts, httpTimeout);
                                        const content: string = JSON.stringify(anonymizedUserGroup, null, 2);

                                        const userGroupFile = path.join(directory, userGroupName + '.json');
                                        fs.writeFile(userGroupFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${userGroupFile}`, err);
                                            }

                                            if (checkResolve(++userGroupCounter, userGroupTotal, 'user groups', fqdn)) {
                                                return resolve();
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} user group ${userGroupName}`, err);

                                        if (checkResolve(++userGroupCounter, userGroupTotal, 'user groups', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`saving user group file for ${userGroup.name} from ${fqdn}`, err);

                                    if (checkResolve(++userGroupCounter, userGroupTotal, 'user groups', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading user groups from ${restBase}`, err);
                return reject(`error downloading user groups from ${restBase}`);
            }
        });

        return p;
    }

    static retrieveUserGroupMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise<any>(async (resolve, reject) => {
            var userGroups: any = {};
            var user_groups: [any];

            try {
                const body = await RestClient.get(`${restBase}/user_groups`, {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                OutputChannelLogging.log(`user groups retrieved`);
                user_groups = body.data;
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving user groups`, err);
                return reject();
            }

            // create map
            user_groups.forEach(userGroup => {
                userGroups[userGroup.id] = userGroup.name;
            });

            resolve(userGroups);
        });

        return p;
    }
}