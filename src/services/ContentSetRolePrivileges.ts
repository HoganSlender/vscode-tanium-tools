/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { SigningUtils } from '../common/signingUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from '../types/signingKey';
import { ServerServerContentSetPrivileges } from './ServerServerContentSetPrivileges';
import { ServerServerContentSetRoles } from './ServerServerContentSetRoles';
import { ServerServerContentSets } from './ServerServerContentSets';
import { SignContentFile } from './SignContentFile';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRolePrivileges': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetRolePrivileges.analyzeContentSetRolePrivileges(uris[0], uris[1], context);
        },
    });
}

export class ContentSetRolePrivileges {
    static async analyzeContentSetRolePrivileges(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingContentSetRolePrivileges',
            'Missing Content Set Role Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedContentSetRolePrivileges',
            'Modified Content Set Role Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedContentSetRolePrivileges',
            'Created Content Set Role Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedContentSetRolePrivileges',
            'Unchanged Content Set Role Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath);
        OutputChannelLogging.log(`missing content set role privileges: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set role privileges: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set role privileges: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set role privileges: ${diffItems.unchanged.length}`);

        const title = 'Content Set Role Privileges';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            readOnly: true,
            openType: OpenType.file,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: diffItems.unchanged,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            openType: OpenType.diff,
        }, panelUnchanged, context, config);

        panelUnchanged.webview.onDidReceiveMessage(async message => {
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

        panelModified.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panelMissing, panelModified, panelCreated].forEach(panel => {
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

        panelMissing.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panelMissing, panelModified, panelCreated].forEach(panel => {
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

        panelCreated.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'initSigningKeys':
                        // collect signing key data
                        await SignContentFile.initSigningKeys(context);

                        const newSigningKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        [panelMissing, panelModified, panelCreated].forEach(panel => {
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

    static generateContentSetRolePrivilegeMap(allowSelfSignedCerts: boolean, httpTimeout: number, session: string, fqdn: string) {

        const p = new Promise<any>(async (resolve, reject) => {
            try {
                const restBase = `https://${fqdn}/api/v2`;

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
