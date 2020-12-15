/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetUserGroupRoleMembershipInputs } from '../parameter-collection/server-server-content-set-user-group-role-memberships-parameters';
import { ContentSetUserGroupRoleMemberships } from './ContentSetUserGroupRoleMemberships';
import { ServerServerContentSetRoles } from './ServerServerContentSetRoles';
import { ServerServerUserGroups } from './ServerServerUserGroups';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetUserGroupRoleMemberships': () => {
            ServerServerContentSetUserGroupRoleMemberships.processContentSetUserGroupRoleMemberships(context);
        },
    });
}

class ServerServerContentSetUserGroupRoleMemberships extends ServerServerBase {
    static async processContentSetUserGroupRoleMemberships(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerContentSetUserGroupRoleMembershipInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%ContentSetUserGroupRoleMemberships`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%ContentSetUserGroupRoleMemberships`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Content Set User Group Role Membership Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `content set retrieval from ${leftFqdn}` });
            await this.processServerContentSetUserGroupRoleMemberships(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set retrieval from ${rightFqdn}` });
            await this.processServerContentSetUserGroupRoleMemberships(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSetUserGroupRoleMemberships.analyzeContentSetUserGroupRoleMemberships(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerContentSetUserGroupRoleMemberships(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                var contentSetRoleMap = await ServerServerContentSetRoles.retrieveContentSetRoleMap(allowSelfSignedCerts, httpTimeout, restBase, session);
                var userGroupMap = await ServerServerUserGroups.retrieveUserGroupMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                (async () => {
                    OutputChannelLogging.log(`content set user group role membership retrieval - initialized for ${fqdn}`);
                    var content_set_user_group_role_memberships: [any];

                    // get packages
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_user_group_role_memberships`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set user group role membership retrieval - complete for ${fqdn}`);
                        content_set_user_group_role_memberships = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set user group role memberships from ${fqdn}`, err);
                        return reject(`retrieving content_set user group role memberships from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetUserGroupRoleMembershipCounter: number = 0;
                    var contentSetUserGroupRoleMembershipTotal: number = content_set_user_group_role_memberships.length;

                    if (contentSetUserGroupRoleMembershipTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content set user group role memberships for ${fqdn}`);
                        return resolve();
                    } else {
                        var i = 0;

                        content_set_user_group_role_memberships.forEach(contentSetUserGroupRoleMembership => {
                            i++;

                            if (i % 30 === 0 || i === contentSetUserGroupRoleMembershipTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${contentSetUserGroupRoleMembershipTotal}`);
                            }

                            // check for deleted
                            if (contentSetUserGroupRoleMembership.deleted_flag === 1) {
                                if (checkResolve(++contentSetUserGroupRoleMembershipCounter, contentSetUserGroupRoleMembershipTotal, 'content set user group role memberships', fqdn)) {
                                    return resolve();
                                }
                            } else {
                                var newObject: any = {
                                    content_set_role: {
                                        name: contentSetRoleMap[contentSetUserGroupRoleMembership.content_set_role.id]
                                    },
                                    user_group: {
                                        name: userGroupMap[contentSetUserGroupRoleMembership.user_group.id]
                                    }
                                };

                                try {
                                    const contentSetName: string = sanitize(newObject.user_group.name + ' ' + newObject.content_set_role.name);

                                    try {

                                        const content: string = JSON.stringify(newObject, null, 2);

                                        const contentSetFile = path.join(directory, contentSetName + '.json');
                                        fs.writeFile(contentSetFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${contentSetFile}`, err);
                                            }

                                            if (checkResolve(++contentSetUserGroupRoleMembershipCounter, contentSetUserGroupRoleMembershipTotal, 'content set user group role memberships', fqdn)) {
                                                return resolve();
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} content set user group role membership ${contentSetName}`, err);

                                        if (checkResolve(++contentSetUserGroupRoleMembershipCounter, contentSetUserGroupRoleMembershipTotal, 'content set user group role memberships', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`saving content set user group role membership file for ${contentSetUserGroupRoleMembership.name} from ${fqdn}`, err);

                                    if (checkResolve(++contentSetUserGroupRoleMembershipCounter, contentSetUserGroupRoleMembershipTotal, 'content set user group role memberships', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content set user group role memberships from ${restBase}`, err);
                return reject(`error downloading content set user group role memberships from ${restBase}`);
            }
        });

        return p;
    }
}