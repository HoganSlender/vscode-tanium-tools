/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { PathUtils } from '../common/pathUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { Session } from '../common/session';
import { reject } from 'lodash';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeUserGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            UserGroups.analyzeUserGroups(uris[0], uris[1], context);
        },
    });
}

export class UserGroups {
    static async analyzeUserGroups(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingUserGroups',
            'Missing User Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedUserGroups',
            'Modified User Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedUserGroups',
            'Created User Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedUserGroups',
            'Unchanged User Groups',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const missingUserGroups = await PathUtils.getMissingItems(left.fsPath, right.fsPath);
        const modifiedUserGroups = await PathUtils.getModifiedItems(left.fsPath, right.fsPath);
        const createdUserGroups = await PathUtils.getCreatedItems(left.fsPath, right.fsPath);
        const unchangedUserGroups = await PathUtils.getUnchangedItems(left.fsPath, right.fsPath);

        OutputChannelLogging.log(`missing user groups: ${missingUserGroups.length}`);
        OutputChannelLogging.log(`modified user groups: ${modifiedUserGroups.length}`);
        OutputChannelLogging.log(`created user groups: ${createdUserGroups.length}`);
        OutputChannelLogging.log(`unchanged user groups: ${unchangedUserGroups.length}`);

        const title = 'User Groups';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: missingUserGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: modifiedUserGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: createdUserGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: unchangedUserGroups,
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

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferUserGroup(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.username,
                            message.password,
                            path,
                            targetPath,
                            message.name,
                        );

                        // send message back
                        panelModified.webview.postMessage({
                            command: 'complete',
                        });
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
                        vscode.window.showInformationMessage("Selected users have been migrated");
                        break;

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferUserGroup(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.username,
                            message.password,
                            path,
                            targetPath,
                            message.name,
                        );

                        // send message back
                        panelMissing.webview.postMessage({
                            command: 'complete',
                        });
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

    static anonymizeUserGroup(userGroup: any): any {
        return {
            name: userGroup.name,
        };
    }

    static async transferUserGroup(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        destFqdn: string,
        username: string,
        password: string,
        filePath: string,
        targetFilePath: string,
        userGroupName: string) {
        const p = new Promise(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get package data from file
                const userGroupFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                try {
                    // get session
                    const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

                    // import user
                    const restBase = `https://${destFqdn}/api/v2`;

                    OutputChannelLogging.log(`importing ${userGroupName} into ${destFqdn}`);

                    const data = await RestClient.post(`${restBase}/user_groups`, {
                        headers: {
                            session: session,
                        },
                        json: userGroupFromFile,
                        responseType: 'json',
                    }, allowSelfSignedCerts, httpTimeout);

                    OutputChannelLogging.log(`importing ${userGroupName} complete`);

                    // create the missing file
                    const targetContents = fs.readFileSync(filePath, 'utf-8');
                    fs.writeFileSync(targetFilePath, targetContents);
                } catch (err) {
                    OutputChannelLogging.logError('error importing user group', err);
                    reject();
                }

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring user groups', err);
                reject();
            }
        });

        return p;
    }
}