/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { WebContentUtils } from '../common/webContentUtils';

import { OpenType } from '../common/enums';
import { SignContentFile } from './SignContentFile';
import { SigningKey } from '../types/signingKey';
import { SigningUtils } from '../common/signingUtils';
import { DiffBase } from './DiffBase';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRoles': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetRoles.analyzeContentSetRoles(uris[0], uris[1], context);
        },
    });
}

export class ContentSetRoles extends DiffBase {
    static async analyzeContentSetRoles(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Content Set Roles',
            leftDir: left.fsPath,
            rightDir: right.fsPath,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeContentSetRoles',
        }, context);

        const panels = this.createPanels('Content Set Roles', diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        OutputChannelLogging.log(`missing content set roles: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set roles: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set roles: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set roles: ${diffItems.unchanged.length}`);

        const title = 'Content Set Roles';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 1,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panels.created, context, config);

        panels.unchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: diffItems.unchanged,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            showSigningKeys: false,
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
                        content_set_roles: []
                    },
                    version: 2
                };

                var content_set_roles: any = [];

                items.forEach(item => {
                    const path = item.path.split('~')[0];
                    const name = item.name;

                    // get content set data from file
                    const contentSetFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));

                    // add to importJson
                    content_set_roles.push(contentSetFromFile);
                });

                importJson.object_list.content_set_roles = content_set_roles;

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
                OutputChannelLogging.logError('error transferring content set roles', err);
                reject();
            }
        });

        return p;
    }

    static retrieveContentSetRoleByName(name: string, fqdn: FqdnSetting, session: string, allowSelfSignedCerts: boolean, httpTimeout: number): any {
        const p: Promise<any> = new Promise<any>(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/content_set_roles/by-name/${name}`, {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                const contentSetRole = body.data;

                resolve(contentSetRole);
            } catch (err) {
                OutputChannelLogging.logError('error retrieving content set role by name', err);
                reject();
            }
        });

        return p;
    }
}
