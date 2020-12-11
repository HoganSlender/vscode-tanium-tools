/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetRoleMembershipInputs } from '../parameter-collection/server-server-content-set-role-memberships-parameters';
import { ContentSetRoleMemberships } from './ContentSetRoleMemberships';
import { ServerServerContentSetRoles } from './ServerServerContentSetRoles';
import { Users } from './Users';

import path = require('path');
import { checkResolve } from '../common/checkResolve';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetRoleMemberships': () => {
            ServerServerContentSetRoleMemberships.processContentSetRoleMemberships(context);
        }
    });
}

class ServerServerContentSetRoleMemberships {

    static async processContentSetRoleMemberships(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetRoleMembershipInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%ContentSetRoleMemberships`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%ContentSetRoleMemberships`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Content Set Role Privilege Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 20;

            progress.report({ increment: increment, message: `content set role retrieval from ${leftFqdn}` });
            await this.processServerContentSetRoleMemberships(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set role retrieval from ${rightFqdn}` });
            await this.processServerContentSetRoleMemberships(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    return resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSetRoleMemberships.analyzeContentSetRoleMemberships(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }
    static processServerContentSetRoleMemberships(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                OutputChannelLogging.log(`content set role retrieval - initialized for ${fqdn}`);
                var contentSetRoles = await ServerServerContentSetRoles.retrieveContentSetRoleMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                OutputChannelLogging.log(`user retrieval - initialized for ${fqdn}`);
                var users = await Users.retrieveUserMapById(allowSelfSignedCerts, httpTimeout, restBase, session);

                (async () => {
                    OutputChannelLogging.log(`content set role memberships retrieval - initialized for ${fqdn}`);
                    var content_set_role_memberships: [any];

                    // get
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_role_memberships`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set role memberships retrieval - complete for ${fqdn}`);
                        content_set_role_memberships = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set role memberships from ${fqdn}`, err);
                        return reject(`retrieving content_set_role memberships from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetRoleMembershipCounter: number = 0;
                    var contentSetRoleMembershipTotal: number = content_set_role_memberships.length;

                    if (contentSetRoleMembershipTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content set role memberships for ${fqdn}`);
                        return resolve();
                    } else {
                        var i = 0;

                        content_set_role_memberships.forEach(contentSetRoleMembership => {
                            i++;

                            if (i % 30 === 0 || i === contentSetRoleMembershipTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${contentSetRoleMembershipTotal}`);
                            }

                            // check for deleted
                            if (contentSetRoleMembership.deleted_flag === 1) {
                                if (checkResolve(++contentSetRoleMembershipCounter, contentSetRoleMembershipTotal, 'content set role memberships', fqdn)) {
                                    return resolve();
                                }
                            } else {
                                var newObject: any = {};

                                newObject['content_set_role'] = {
                                    name: contentSetRoles[contentSetRoleMembership.content_set_role.id]
                                };

                                newObject['user'] = users[contentSetRoleMembership.user.id];

                                // get export
                                try {
                                    const contentSetRoleMembershipName: string = sanitize(newObject.user.name + '-' + newObject.content_set_role.name);

                                    try {
                                        const content: string = JSON.stringify(newObject, null, 2);

                                        const contentSetRoleMembershipFile = path.join(directory, contentSetRoleMembershipName + '.json');
                                        fs.writeFile(contentSetRoleMembershipFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${contentSetRoleMembershipFile}`, err);
                                            }

                                            if (checkResolve(++contentSetRoleMembershipCounter, contentSetRoleMembershipTotal, 'content set role memberships', fqdn)) {
                                                return resolve();
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} content set role memberships ${contentSetRoleMembershipName}`, err);

                                        if (checkResolve(++contentSetRoleMembershipCounter, contentSetRoleMembershipTotal, 'content set role memberships', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`saving content set role membership file for ${contentSetRoleMembership.name} from ${fqdn}`, err);

                                    if (checkResolve(++contentSetRoleMembershipCounter, contentSetRoleMembershipTotal, 'content set role memberships', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content set role memberships from ${restBase}`, err);
                return reject(`error downloading content set role memberships from ${restBase}`);
            }
        });

        return p;
    }
}