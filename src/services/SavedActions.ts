/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { DiffItemData, PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { SigningUtils } from '../common/signingUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from '../types/signingKey';

import { DiffBase } from './DiffBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeSavedActions': (diffItems: DiffItemData) => {
            SavedActions.analyzeSavedActions(diffItems, context);
        },
    });
}

export class SavedActions extends DiffBase {
    static async analyzeSavedActions(diffItems: DiffItemData, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const panels = this.createPanels('Saved Actions', diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`missing saved actions: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified saved actions: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created saved actions: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged saved actions: ${diffItems.unchanged.length}`);

        const title = 'Saved Actions';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
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
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected saved actions have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            signingKey!,
                            allowSelfSignedCerts,
                            httpTimeout,
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
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected saved actions have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            signingKey!,
                            allowSelfSignedCerts,
                            httpTimeout,
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

    static transferItems(
        sourceFqdn: FqdnSetting,
        sourceUsername: string,
        sourcePassword: string,
        signingKey: SigningKey,
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        items: any[]
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get names from each item
                const savedActionNames: string[] = [];
                items.forEach((item) => {
                    const path = item.path.split('~')[0];

                    // get sensor from file
                    const savedActionFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));
                    savedActionNames.push(savedActionFromFile.name);
                });

                // generate json
                var exportJson = {
                    saved_actions: {
                        include: savedActionNames
                    }
                };

                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);

                const body = await RestClient.post(`https://${sourceFqdn.fqdn}/api/v2/export`, {
                    headers: {
                        session: session,
                    },
                    json: exportJson,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                // generate import json
                var importJson = body.data;

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
                OutputChannelLogging.logError('error in transferItems', err);
                reject();
            }
        });

        return p;
    }
}
