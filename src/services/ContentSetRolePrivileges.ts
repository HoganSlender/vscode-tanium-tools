/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { DiffItemData, PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { SigningUtils } from '../common/signingUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { SigningKey } from '../types/signingKey';
import { DiffBase } from './DiffBase';
import { ServerServerContentSetPrivileges } from './ServerServerContentSetPrivileges';
import { ServerServerContentSetRoles } from './ServerServerContentSetRoles';
import { ServerServerContentSets } from './ServerServerContentSets';
import { SignContentFile } from './SignContentFile';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRolePrivileges': (diffItems: DiffItemData) => {
            ContentSetRolePrivileges.analyzeContentSetRolePrivileges(diffItems, context);
        },
    });
}

export class ContentSetRolePrivileges extends DiffBase {
    static async analyzeContentSetRolePrivileges(diffItems: DiffItemData, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const panels = this.createPanels('Content Set Role Privileges', diffItems);


        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');

        OutputChannelLogging.log(`missing content set role privileges: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set role privileges: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set role privileges: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set role privileges: ${diffItems.unchanged.length}`);

        const title = 'Content Set Role Privileges';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.file,
        }, panels.created, context, config);

        panels.unchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: diffItems.unchanged,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            openType: OpenType.diff,
        }, panels.unchanged, context, config);

        panels.unchanged.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case "openDiff":
                        var items = message.path.split('~');
                        var lPath = items[0];
                        var rPath = items[2];
                        var title = `${message.name}.json (${PathUtils.getPath(lPath)} ↔ ${PathUtils.getPath(rPath)})`;
                        vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(lPath), vscode.Uri.file(rPath), title, {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.modified.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panels.missing, panels.modified, panels.created].forEach(panel => {
                            panel.webview.postMessage({
                                command: 'signingKeysInitialized',
                                signingKey: newSigningKeys[0].serverLabel,
                            });
                        });
                        break;

                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            signingKey!,
                            message.items,
                        );
                        break;

                    case "openDiff":
                        var diffItems = message.path.split('~');
                        var lPath = diffItems[0];
                        var rPath = diffItems[2];
                        var title = `${message.name}.json (${PathUtils.getPath(lPath)} ↔ ${PathUtils.getPath(rPath)})`;
                        vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(lPath), vscode.Uri.file(rPath), title, {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.missing.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panels.missing, panels.modified, panels.created].forEach(panel => {
                            panel.webview.postMessage({
                                command: 'signingKeysInitialized',
                                signingKey: newSigningKeys[0].serverLabel,
                            });
                        });
                        break;

                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            signingKey!,
                            message.items,
                        );
                        break;

                    case "openFile":
                        var lPath = message.path.split('~')[0];
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(lPath), {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.created.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panels.missing, panels.modified, panels.created].forEach(panel => {
                            panel.webview.postMessage({
                                command: 'signingKeysInitialized',
                                signingKey: newSigningKeys[0].serverLabel,
                            });
                        });
                        break;

                    case "openFile":
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.path), {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });
    }

    static async transferItems(
        signingKey: SigningKey,
        items: any[]
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // generate json
                var importJson = {
                    object_list: {
                        content_set_privileges: []
                    },
                    version: 2
                };

                var content_set_privileges: any = [];

                items.forEach(item => {
                    const path = item.path.split('~')[0];
                    const name = item.name;

                    // get content set data from file
                    const contentSetFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));

                    // add to importJson
                    content_set_privileges.push(contentSetFromFile);
                });

                importJson.object_list.content_set_privileges = content_set_privileges;

                // save file to base
                const baseDir = PathUtils.getPath(PathUtils.getPath(items[0].path.split('~')[0]));
                const filePath = await SigningUtils.writeFileAndSign(importJson, signingKey, baseDir);

                // open file
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active,
                });

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring content set role privileges', err);
                reject();
            }
        });

        return p;
    }

    static generateContentSetRolePrivilegeMap(allowSelfSignedCerts: boolean, httpTimeout: number, session: string, fqdn: FqdnSetting) {

        const p = new Promise<any>(async (resolve, reject) => {
            try {
                const restBase = `https://${fqdn.fqdn}/api/v2`;

                const retval: any = {};

                var contentSetMap = await ServerServerContentSets.retrieveContentSetMap(allowSelfSignedCerts, httpTimeout, restBase, session);
                var contentSetRoleMap = await ServerServerContentSetRoles.retrieveContentSetRoleMap(allowSelfSignedCerts, httpTimeout, restBase, session);
                var contentSetPrivilegeMap = await ServerServerContentSetPrivileges.retrieveContentSetPrivilegeMap(allowSelfSignedCerts, httpTimeout, restBase, session);

                const body = await RestClient.get(`${restBase}/content_set_role_privileges`, {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);


                body.data.forEach((contentSetRolePrivilege: any) => {
                    if (contentSetRolePrivilege.content_set && contentSetRolePrivilege.content_set_privilege && contentSetRolePrivilege.content_set_role) {
                        const newObject: any = {
                            content_set: {
                                name: contentSetMap[contentSetRolePrivilege.content_set.id],
                            },
                            content_set_role: {
                                name: contentSetRoleMap[contentSetRolePrivilege.content_set_role.id],
                            },
                            content_set_privilege: {
                                name: contentSetPrivilegeMap[contentSetRolePrivilege.content_set_privilege.id],
                            }
                        };

                        retval[newObject.content_set.name + '-' + newObject.content_set_role.name + '-' + newObject.content_set_privilege.name] = newObject;
                    }
                });

                resolve(retval);
            } catch (err) {
                OutputChannelLogging.logError('error in generateContentSetRolePrivilegeMap', err);
                reject();
            }
        });

        return p;
    }
}
