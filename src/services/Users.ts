/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { PathUtils } from '../common/pathUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { Session } from '../common/session';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeUsers': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Users.analyzeUsers(uris[0], uris[1], context);
        },
    });
}

export class Users {
    static async analyzeUsers(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingUsers',
            'Missing Users',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedUsers',
            'Modified Users',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedUsers',
            'Created Users',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedUsers',
            'Unchanged Users',
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

        const missingUsers = await PathUtils.getMissingItems(left.fsPath, right.fsPath);
        const modifiedUsers = await PathUtils.getModifiedItems(left.fsPath, right.fsPath);
        const createdUsers = await PathUtils.getCreatedItems(left.fsPath, right.fsPath);
        const unchangedUsers = await PathUtils.getUnchangedItems(left.fsPath, right.fsPath);

        OutputChannelLogging.log(`missing users: ${missingUsers.length}`);
        OutputChannelLogging.log(`modified users: ${modifiedUsers.length}`);
        OutputChannelLogging.log(`created users: ${createdUsers.length}`);
        OutputChannelLogging.log(`unchanged users: ${unchangedUsers.length}`);

        const title = 'Users';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: missingUsers,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: modifiedUsers,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: createdUsers,
            transferIndividual: 1,
            showServerInfo: 1,
            noSourceServer: true,
            noSigningKeys: true,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: unchangedUsers,
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

                        await this.transferUser(
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

                        await this.transferUser(
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

    static retrieveUserMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise((resolve, reject) => {
            try {
                (async () => {
                    var users: any = {};
                    var userData: [any];

                    // get users
                    try {
                        const body = await RestClient.get(`${restBase}/users`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`users retrieved`);
                        userData = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`error retrieving users`, err);
                        return reject();
                    }

                    // create map
                    for (var i = 0; i < userData.length; i++) {
                        const user = userData[i];
                        var newObject = this.anonymizeUser(user);
                        users[user.id] = newObject;
                    }

                    resolve(users);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving users`, err);
                reject();
            }
        });

        return p;
    }

    static anonymizeUser(user: any): any {
        return {
            name: user.name,
            display_name: user.display_name,
        };
    }

    static async transferUser(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        destFqdn: string,
        username: string,
        password: string,
        filePath: string,
        targetFilePath: string,
        userName: string) {
        OutputChannelLogging.initialize();

        // get package data from file
        const userFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        try {
            // get session
            const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

            // import user
            const restBase = `https://${destFqdn}/api/v2`;

            OutputChannelLogging.log(`importing ${userName} into ${destFqdn}`);

            const data = await RestClient.post(`${restBase}/users`, {
                headers: {
                    session: session,
                },
                json: userFromFile,
                responseType: 'json',
            }, allowSelfSignedCerts, httpTimeout);

            OutputChannelLogging.log(`importing ${userName} complete`);

            // create the missing file
            const targetContents = fs.readFileSync(filePath, 'utf-8');
            fs.writeFileSync(targetFilePath, targetContents);
        } catch (err) {
            OutputChannelLogging.logError('error importing user', err);
        }
    }
}