/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from "../common/enums";
import { OutputChannelLogging } from "../common/logging";
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { SigningUtils } from '../common/signingUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from "../types/signingKey";
import { SignContentFile } from './SignContentFile';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeSensors': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Sensors.analyzeSensors(uris[0], uris[1], context);
        },
    });
}

export class Sensors {
    static async analyzeSensors(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        var title = 'Sensors';

        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingSensors',
            `Missing ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedSensors',
            `Modified ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedSensors',
            `Created ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedSensors',
            `Unchanged ${title}`,
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
        OutputChannelLogging.log(`missing sensors: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified sensors: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created sensors: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged sensors: ${diffItems.unchanged.length}`);

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
            showDestServer: true,
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
                        vscode.window.showInformationMessage("Selected sensors have been migrated");
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
                        vscode.window.showInformationMessage("Selected sensors have been migrated");
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
    static transferItems(
        sourceFqdn: string,
        sourceUsername: string,
        sourcePassword: string,
        signingKey: SigningKey,
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        items: any[]) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get names from each item
                const sensorNames: string[] = [];
                items.forEach((item) => {
                    const path = item.path.split('~')[0];

                    // get sensor from file
                    const sensorFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));
                    sensorNames.push(sensorFromFile.name);
                });

                // generate json
                var exportJson = {
                    sensors: {
                        include: sensorNames
                    }
                };

                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);

                const body = await RestClient.post(`https://${sourceFqdn}/api/v2/export`, {
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