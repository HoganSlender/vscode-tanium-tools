/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path = require('path');
import * as pug from 'pug';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { WebContentUtils } from '../common/webContentUtils';

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

        const missingContentSetRolePrivileges = await PathUtils.getMissingItems(left.fsPath, right.fsPath);
        const modifiedContentSetRolePrivileges = await PathUtils.getModifiedItems(left.fsPath, right.fsPath);
        const createdContentSetRolePrivileges = await PathUtils.getCreatedItems(left.fsPath, right.fsPath);
        const unchangedContentSetRolePrivileges = await PathUtils.getUnchangedItems(left.fsPath, right.fsPath);

        OutputChannelLogging.log(`missing content set role privileges: ${missingContentSetRolePrivileges.length}`);
        OutputChannelLogging.log(`modified content set role privileges: ${modifiedContentSetRolePrivileges.length}`);
        OutputChannelLogging.log(`created content set role privileges: ${createdContentSetRolePrivileges.length}`);
        OutputChannelLogging.log(`unchanged content set role privileges: ${unchangedContentSetRolePrivileges.length}`);

        const title = 'Content Set Role Privileges';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: missingContentSetRolePrivileges,
            transferIndividual: 0,
            showServerInfo: 0,
            readOnly: true
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: modifiedContentSetRolePrivileges,
            transferIndividual: 0,
            showServerInfo: 0,
            readOnly: true
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: createdContentSetRolePrivileges,
            transferIndividual: 0,
            showServerInfo: 0,
            readOnly: true
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: unchangedContentSetRolePrivileges,
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
                        await this.transferItems(
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
                        await this.transferItems(
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

    static async transferItems(items: any[]) {
        const p = new Promise((resolve, reject) => {
            try {
                // generate json
                var importJson = {
                    object_list: {
                        content_set_privileges: []
                    },
                    version: 2
                };

                var content_set_privileges: any = [];

                for (var i = 0; i < items.length; i++) {
                    const item = items[i];

                    const path = item.path.split('~')[0];
                    const name = item.name;

                    // get content set data from file
                    const contentSetFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));

                    // add to importJson
                    content_set_privileges.push(contentSetFromFile);
                }

                importJson.object_list.content_set_privileges = content_set_privileges;

                // save file to base
                const baseDir = PathUtils.getPath(PathUtils.getPath(items[0].path.split('~')[0]));
                const tempPath = path.join(baseDir, uuidv4() + '.json');
                fs.writeFileSync(tempPath, `${JSON.stringify(importJson, null, 2)}\r\n`, 'utf-8');

                // open file
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(tempPath), {
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
}
