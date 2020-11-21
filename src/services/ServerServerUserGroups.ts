/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { collectServerServerUserGroupsInputs } from '../parameter-collection/server-server-user-groups-parameters';
import { UserGroups } from './UserGroups';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerUserGroups': () => {
            ServerServerUserGroups.processUserGroups(context);
        }
    });
}

class ServerServerUserGroups {
    public static async processUserGroups(context: vscode.ExtensionContext) { 
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

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
            title: 'User Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `user retrieval from ${leftFqdn}` });
            await this.processServerUserGroups(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `user retrieval from ${rightFqdn}` });
            await this.processServerUserGroups(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
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

        const p = new Promise(async (resolve, reject) => {
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
                    var userGroupCounter = 0;
                    var userGroupTotal = userGroups.length;
                    for (var i = 0; i < userGroupTotal; i++) {
                        const userGroup: any = userGroups[i];

                        if (i % 30 === 0 || i === userGroupTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${userGroupTotal}`);
                        }

                        if (userGroup.deleted_flag) {
                            userGroupCounter++;

                            if (userGroupTotal === userGroupCounter) {
                                OutputChannelLogging.log(`processed ${userGroupTotal} user groups from ${fqdn}`);
                                resolve();
                            }
                        } else {
                            // get export
                            try {
                                const userGroupName: string = sanitize(userGroup.name);

                                try {
                                    const anonymizedUserGroup = UserGroups.anonymizeUserGroup(userGroup);
                                    const content: string = JSON.stringify(anonymizedUserGroup, null, 2);

                                    const userGroupFile = path.join(directory, userGroupName + '.json');
                                    fs.writeFile(userGroupFile, content, (err) => {
                                        if (err) {
                                            OutputChannelLogging.logError(`could not write ${userGroupFile}`, err);
                                        }

                                        userGroupCounter++;

                                        if (userGroupTotal === userGroupCounter) {
                                            OutputChannelLogging.log(`processed ${userGroupTotal} user groups from ${fqdn}`);
                                            resolve();
                                        }
                                    });
                                } catch (err) {
                                    OutputChannelLogging.logError(`error processing ${label} user group ${userGroupName}`, err);
                                    userGroupCounter++;

                                    if (userGroupTotal === userGroupCounter) {
                                        OutputChannelLogging.log(`processed ${userGroupTotal} user group from ${fqdn}`);
                                        resolve();
                                    }
                                }
                            } catch (err) {
                                OutputChannelLogging.logError(`saving user group file for ${userGroup.name} from ${fqdn}`, err);
                                userGroupCounter++;

                                if (userGroupTotal === userGroupCounter) {
                                    OutputChannelLogging.log(`processed ${userGroupTotal} user groups from ${fqdn}`);
                                    resolve();
                                }
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading user groups from ${restBase}`, err);
                return reject(`error downloading user groups from ${restBase}`);
            }
        });

        return p;
    }
}