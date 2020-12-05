/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { WebContentUtils } from '../common/webContentUtils';

import path = require('path');
import { OpenType } from '../common/enums';
import { SignContentFile } from './SignContentFile';
import { SigningKey } from '../types/signingKey';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRoles': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetRoles.analyzeContentSetRoles(uris[0], uris[1], context);
        },
    });
}

export class ContentSetRoles {
    static async analyzeContentSetRoles(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingContentSetRoles',
            'Missing Content Set Roles',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedContentSetRoles',
            'Modified Content Set Roles',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedContentSetRoles',
            'Created Content Set Roles',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedContentSetRoles',
            'Unchanged Content Set Roles',
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
        OutputChannelLogging.log(`missing content set roles: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set roles: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set roles: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set roles: ${diffItems.unchanged.length}`);

        const title = 'Content Set Roles';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: diffItems.unchanged,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            showSigningKeys: false,
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
        const p = new Promise((resolve, reject) => {
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
                const tempPath = path.join(baseDir, uuidv4() + '.json');
                fs.writeFileSync(tempPath, `${JSON.stringify(importJson, null, 2)}\r\n`, 'utf-8');

                // sign the file
                SignContentFile.signContent(signingKey.keyUtilityPath, signingKey.privateKeyFilePath, tempPath);

                // open file
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(tempPath), {
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

    static retrieveContentSetRoleByName(name: string, fqdn: string, session: string, allowSelfSignedCerts: boolean, httpTimeout: number): any {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`https://${fqdn}/api/v2/content_set_roles/by-name/${name}`, {
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
