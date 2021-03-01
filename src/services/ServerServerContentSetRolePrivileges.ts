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
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { PathUtils } from '../common/pathUtils';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerContentSetRolePrivileges': () => {
            ServerServerContentSetRolePrivileges.processContentSetRolePrivileges(context);
        }
    });
}

class ServerServerContentSetRolePrivileges extends ServerServerBase {
    static async processContentSetRolePrivileges(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerContentSetRolePrivilegeInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%ContentSetRolePrivileges`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%ContentSetRolePrivileges`);

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

            progress.report({ increment: increment, message: `content set role privilege retrieval from ${leftFqdn.label}` });
            await this.processServerContentSetRolePrivileges(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `content set role privilege retrieval from ${rightFqdn.label}` });
            await this.processServerContentSetRolePrivileges(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    return resolve();
                }, 3000);
            });

            return p;
        });

        // analyze content sets
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Content Set Role Privileges',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeContentSetRolePrivileges',
            useLabel: false
        }, context);

        ContentSetRolePrivileges.analyzeContentSetRolePrivileges(diffItems, context);
    }

    static processServerContentSetRolePrivileges(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                OutputChannelLogging.log(`content set retrieval - initialized for ${fqdn.label}`);
                var contentSets = await ServerServerContentSets.retrieveContentSetMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                OutputChannelLogging.log(`content set role retrieval - initialized for ${fqdn.label}`);
                var contentSetRoles = await ServerServerContentSetRoles.retrieveContentSetRoleMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                OutputChannelLogging.log(`content set privilege retrieval - initialized for ${fqdn.label}`);
                var contentSetPrivileges = await ServerServerContentSetPrivileges.retrieveContentSetPrivilegeMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                (async () => {
                    OutputChannelLogging.log(`content set role privileges retrieval - initialized for ${fqdn.label}`);
                    var content_set_role_privileges: [any];

                    // get
                    try {
                        const body = await RestClient.get(`${restBase}/content_set_role_privileges`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`content set role privileges retrieval - complete for ${fqdn.label}`);
                        content_set_role_privileges = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving content set role privileges from ${fqdn.label}`, err);
                        return reject(`retrieving content_set_role privileges from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var contentSetRolePrivilegeCounter: number = 0;
                    var contentSetRolePrivilegeTotal: number = content_set_role_privileges.length;

                    if (contentSetRolePrivilegeTotal === 0) {
                        OutputChannelLogging.log(`there are 0 content set user group role privileges for ${fqdn.label}`);
                        return resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({
                                increment: 0
                            });

                            const innerIncrement = 100 / content_set_role_privileges.length;

                            for (var i = 0; i < content_set_role_privileges.length; i++) {
                                const contentSetRolePrivilege = content_set_role_privileges[i];
                                
                                // check for deleted
                                if (contentSetRolePrivilege.deleted_flag === 1) {
                                    if (checkResolve(++contentSetRolePrivilegeCounter, contentSetRolePrivilegeTotal, 'content set role privileges', fqdn)) {
                                        return resolve();
                                    }
                                } else {
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

                                    // get export
                                    try {
                                        const contentSetRolePrivilegeName: string = sanitize(newObject.content_set?.name + '-' + newObject.content_set_role?.name + '-' + newObject.content_set_privilege?.name);

                                        innerProgress.report({
                                            increment: innerIncrement,
                                            message: `${i + 1}/${content_set_role_privileges.length}: ${contentSetRolePrivilegeName}`
                                        });

                                        try {
                                            const content: string = JSON.stringify(newObject, null, 2);

                                            const contentSetRolePrivilegeFile = path.join(directory, contentSetRolePrivilegeName + '.json');
                                            fs.writeFile(contentSetRolePrivilegeFile, content, (err) => {
                                                if (err) {
                                                    OutputChannelLogging.logError(`could not write ${contentSetRolePrivilegeFile}`, err);
                                                }

                                                if (checkResolve(++contentSetRolePrivilegeCounter, contentSetRolePrivilegeTotal, 'content set role privileges', fqdn)) {
                                                    return resolve();
                                                }
                                            });
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} content set role privileges ${contentSetRolePrivilegeName}`, err);

                                            if (checkResolve(++contentSetRolePrivilegeCounter, contentSetRolePrivilegeTotal, 'content set role privileges', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`saving content set role privilege file for ${contentSetRolePrivilege.name} from ${fqdn.label}`, err);

                                        if (checkResolve(++contentSetRolePrivilegeCounter, contentSetRolePrivilegeTotal, 'content set role privileges', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }

                            content_set_role_privileges.forEach(contentSetRolePrivilege => {
                            });
                        });
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