/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetRolePrivilegeInputs } from '../parameter-collection/server-server-content-set-role-privileges-parameters';
import { ContentSetRolePrivileges } from './ContentSetRolePrivileges';
import { ServerServerContentSetPrivileges } from './ServerServerContentSetPrivileges';
import { ServerServerContentSetRoles } from './ServerServerContentSetRoles';
import { ServerServerContentSets } from './ServerServerContentSets';

import path = require('path');

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetRolePrivileges': () => {
            ServerServerContentSetRolePrivileges.processContentSetRolePrivileges(context);
        }
    });
}

class ServerServerContentSetRolePrivileges {
    static async processContentSetRolePrivileges(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerContentSetRolePrivilegeInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%ContentSetRolePrivileges`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%ContentSetRolePrivileges`);

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
            await this.processServerContentSetRolePrivileges(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set role retrieval from ${rightFqdn}` });
            await this.processServerContentSetRolePrivileges(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        ContentSetRolePrivileges.analyzeContentSetRolePrivileges(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerContentSetRolePrivileges(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                OutputChannelLogging.log(`content set retrieval - initialized for ${fqdn}`);
                var contentSets = await ServerServerContentSets.retrieveContentSetMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                OutputChannelLogging.log(`content set role retrieval - initialized for ${fqdn}`);
                var contentSetRoles = await ServerServerContentSetRoles.retrieveContentSetRoleMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                OutputChannelLogging.log(`content set privilege retrieval - initialized for ${fqdn}`);
                var contentSetPrivileges = await ServerServerContentSetPrivileges.retrieveContentSetPrivilegeMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                (async () => {
                    OutputChannelLogging.log(`content set role privileges retrieval - initialized for ${fqdn}`);
                    var content_set_role_privileges: [any];

                    // get
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_role_privileges`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set role privileges retrieval - complete for ${fqdn}`);
                        content_set_role_privileges = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set role privileges from ${fqdn}`, err);
                        return reject(`retrieving content_set_role privileges from ${fqdn}`);
                    }

                    // iterate through each download export
                    var contentSetRolePrivilegeTotal: number = content_set_role_privileges.length;

                    if (contentSetRolePrivilegeTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content set user group role privileges for ${fqdn}`);
                        resolve();
                    } else {
                        var i = 0;

                        content_set_role_privileges.forEach(contentSetRolePrivilege => {
                            i++;
                            
                            // check for deleted
                            if (contentSetRolePrivilege.deleted_flag === 0) {
                                var newObject: any = {};

                                if (contentSetRolePrivilege.content_set === null) {
                                    newObject['content_set'] = null;
                                } else {
                                    newObject['content_set'] = {
                                        name: contentSets[contentSetRolePrivilege.content_set.id]
                                    };
                                }

                                if (contentSetRolePrivilege.content_set_role === null) {
                                    newObject['content_set_role'] = null;
                                } else {
                                    newObject['content_set_role'] = {
                                        name: contentSetRoles[contentSetRolePrivilege.content_set_role.id]
                                    };
                                }

                                if (contentSetRolePrivilege.content_set_privilege === null) {
                                    newObject['content_set_privilege'] = null;
                                } else {
                                    newObject['content_set_privilege'] = {
                                        name: contentSetPrivileges[contentSetRolePrivilege.content_set_privilege.id]
                                    };
                                }

                                if (i % 30 === 0 || i === contentSetRolePrivilegeTotal) {
                                    OutputChannelLogging.log(`processing ${i} of ${contentSetRolePrivilegeTotal}`);
                                }

                                // get export
                                try {
                                    const contentSetRolePrivilegeName: string = sanitize(newObject.content_set.name + '-' + newObject.content_set_role.name + '-' + newObject.content_set_privilege.name);

                                    try {
                                        const content: string = JSON.stringify(newObject, null, 2);

                                        const contentSetRolePrivilegeFile = path.join(directory, contentSetRolePrivilegeName + '.json');
                                        fs.writeFile(contentSetRolePrivilegeFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${contentSetRolePrivilegeFile}`, err);
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} content set role privileges ${contentSetRolePrivilegeName}`, err);
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`saving content set role privilege file for ${contentSetRolePrivilege.name} from ${fqdn}`, err);
                                }
                            }
                        });

                        resolve();
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading content set role privileges from ${restBase}`, err);
                return reject(`error downloading content set role privileges from ${restBase}`);
            }
        });

        return p;
    }
}