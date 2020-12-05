/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { MrGroupType, OpenType, Operation } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from '../types/signingKey';
import { Groups } from './Groups';

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

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath);
        OutputChannelLogging.log(`missing users: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified users: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created users: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged users: ${diffItems.unchanged.length}`);

        const title = 'Users';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 1,
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
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferUser(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                            Operation.update,
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

                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferUser(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                            Operation.insert,
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

    static retrieveUserMapById(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
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

                    // get groups map
                    const groupMap = Groups.getGroupMapById(allowSelfSignedCerts, httpTimeout, restBase, session);

                    // create map
                    userData.forEach(user => {
                        var newObject = this.anonymizeUser(user, groupMap);
                        users[user.id] = newObject;
                    });

                    resolve(users);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving users`, err);
                reject();
            }
        });

        return p;
    }

    static retrieveUserMapByName(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, session: string): any {
        const p = new Promise((resolve, reject) => {
            try {
                (async () => {
                    var users: any = {};
                    var userData: [any];

                    // get users
                    try {
                        const body = await RestClient.get(`https://${fqdn}/api/v2/users`, {
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
                    userData.forEach(user => {
                        users[user.name] = user;
                    });

                    resolve(users);
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving users`, err);
                reject();
            }
        });

        return p;
    }

    static anonymizeUser(user: any, groupMap: any): any {
        var retVal: any = {
            name: user.name,
            display_name: user.display_name,
        };

        // get computer group
        if (user.group_id !== 0) {
            retVal.group = {
                name: groupMap[user.group_id].name,
            };
        }

        return retVal;
    }

    static async transferUser(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        sourceFqdn: string,
        sourceUsername: string,
        sourcePassword: string,
        destFqdn: string,
        destUsername: string,
        destPassword: string,
        filePath: string,
        targetFilePath: string,
        signingKey: SigningKey,
        userName: string,
        operationType: Operation
    ) {
        const p = new Promise(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get package data from file
                const userFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                try {
                    // import user
                    const destRestBase = `https://${destFqdn}/api/v2`;

                    const sourceSession = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);
                    const destSession = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, destUsername, destPassword);

                    OutputChannelLogging.log(`importing ${userName} into ${destFqdn}`);

                    // get group info from source
                    if (userFromFile.group !== undefined) {
                        userFromFile.group_id = await Groups.setUpMrGroupInDest(userFromFile.group.name, allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceSession, destFqdn, destSession, signingKey, MrGroupType.user, userFromFile.name);

                        // remove group
                        delete userFromFile.group;
                    } else {
                        // group is undefined, so set group id to 0
                        userFromFile.group_id = 0;
                    }

                    // set group info on dest
                    if (operationType === Operation.insert) {
                        await RestClient.post(`${destRestBase}/users`, {
                            headers: {
                                session: destSession,
                            },
                            json: userFromFile,
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);
                    } else if (operationType === Operation.update) {
                        const url = `${destRestBase}/users/by-name/${userFromFile.name}`;

                        // remove name property to avoid TooManyTagsWithSameName error
                        delete userFromFile.name;

                        await RestClient.patch(url, {
                            headers: {
                                session: destSession,
                            },
                            json: userFromFile,
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);
                    }

                    OutputChannelLogging.log(`importing ${userName} complete`);

                    // create the missing file
                    const targetContents = fs.readFileSync(filePath, 'utf-8');
                    fs.writeFileSync(targetFilePath, targetContents);
                } catch (err) {
                    OutputChannelLogging.logError('error importing user', err);
                    OutputChannelLogging.log(`import json: ${JSON.stringify(userFromFile, null, 2)}`);
                    reject();
                }

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring users', err);
                reject();
            }
        });

        return p;
    }
}