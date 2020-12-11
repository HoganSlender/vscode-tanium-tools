/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from '../types/signingKey';
import { SignContentFile } from './SignContentFile';

import path = require('path');
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { SigningUtils } from '../common/signingUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeDashboardGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            DashboardGroups.analyzeDashboardGroups(uris[0], uris[1], context);
        },
    });
}

export class DashboardGroups {
    static async analyzeDashboardGroups(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingDashboardGroups',
            'Missing Dashboard Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedDashboardGroups',
            'Modified Dashboard Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedDashboardGroups',
            'Created Dashboard Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedDashboardGroups',
            'Unchanged Dashboard Groups',
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
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath, true);
        OutputChannelLogging.log(`missing dashboard groups: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified dashboard groups: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created dashboard groups: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged dashboard groups: ${diffItems.unchanged.length}`);

        const title = 'DashboardGroups';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: false,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 0,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
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
                        vscode.window.showInformationMessage("Selected dashboard groups have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
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
                        vscode.window.showInformationMessage("Selected dashboard groups have been migrated");
                        break;

                    case 'transferItems':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferItems(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
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
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        sourceFqdn: string,
        sourceUsername: string,
        sourcePassword: string,
        signingKey: SigningKey,
        items: any[],
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                const dashboardGroupNames: string[] = [];
                items.forEach(item => {
                    const path = item.path.split('~')[0];
                    const name = item.name;

                    // get content set data from file
                    const dashboardGroupFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));

                    // process dashboards
                    dashboardGroupNames.push(dashboardGroupFromFile.name);
                });

                // generate export json
                var exportJson = {
                    dashboard_groups: {
                        include: dashboardGroupNames
                    }
                };

                // get session
                var session = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);

                // get saved_questions export so we can get needed sensors
                const body = await RestClient.post(`https://${sourceFqdn}/api/v2/export`, {
                    headers: {
                        session: session,
                    },
                    json: exportJson,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                // save file to base
                const baseDir = PathUtils.getPath(PathUtils.getPath(items[0].path.split('~')[0]));
                const filePath = await SigningUtils.writeFileAndSign(body.data, signingKey, baseDir);

                // open file
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active,
                });

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring content set privileges', err);
                reject();
            }
        });

        return p;
    }
}
