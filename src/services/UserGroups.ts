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
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { SigningKey } from '../types/signingKey';
import { DiffBase } from './DiffBase';
import { Groups } from './Groups';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeUserGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            UserGroups.analyzeUserGroups(uris[0], uris[1], context);
        },
    });
}

export class UserGroups extends DiffBase {
    static async analyzeUserGroups(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'User Groups',
            leftDir: left.fsPath,
            rightDir: right.fsPath,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeUserGroups',
        }, context);

        const panels = this.createPanels('User Groups', diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        OutputChannelLogging.log(`missing user groups: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified user groups: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created user groups: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged user groups: ${diffItems.unchanged.length}`);

        const title = 'User Groups';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
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
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferUserGroup(
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
                        panels.modified.webview.postMessage({
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

        panels.missing.webview.onDidReceiveMessage(async message => {
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

                        await this.transferUserGroup(
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
                        panels.missing.webview.postMessage({
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

    static async anonymizeUserGroup(userGroup: any, groupMap: any, restBase: string, session: string, allowSelfSignedCerts: boolean, httpTimeout: number): Promise<any> {
        var retval: any = {
            name: userGroup.name
        };

        // get computer group
        if (userGroup.group !== undefined && userGroup.group.id !== 0) {
            retval.group = {
                name: groupMap[userGroup.group.id].name,
            };

            // check for mrgroup_
            if (retval.group.name.startsWith('mrgroup_')) {
                // need to get export of group since names will never match
                const groupExport = await Groups.getGroupExportByNames([retval.group.name], allowSelfSignedCerts, httpTimeout, restBase, session);

                retval.group = groupExport.object_list.groups[0];

                // replace the name since it will not match
                retval.group.name = 'mrgroup_';
            }
        }

        return retval;
    }

    static async transferUserGroup(
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
        userGroupName: string,
        operationType: Operation
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get package data from file
                const userGroupFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                try {
                    // import user
                    const destRestBase = `https://${destFqdn}/api/v2`;

                    const sourceSession = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);
                    const destSession = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, destUsername, destPassword);

                    OutputChannelLogging.log(`importing ${userGroupName} into ${destFqdn}`);

                    // get group info from source
                    if (userGroupFromFile.group !== undefined) {
                        userGroupFromFile.group.id = await Groups.setUpMrGroupInDest(userGroupFromFile.group.name, allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceSession, destFqdn, destSession, signingKey, MrGroupType.userGroup, userGroupFromFile.name);
                    } else {
                        // group is undefined, so set group id to 0
                        userGroupFromFile.group.id = 0;
                    }

                    if (operationType === Operation.insert) {
                        await RestClient.post(`${destRestBase}/user_groups`, {
                            headers: {
                                session: destSession,
                            },
                            json: userGroupFromFile,
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);
                    } else if (operationType === Operation.update) {
                        // get id of target user group
                        const targetId = await this.retrieveUserGroupByName(userGroupFromFile.name, allowSelfSignedCerts, httpTimeout, destFqdn, destSession);

                        // update target
                        await RestClient.patch(`${destRestBase}/user_groups/${targetId}`, {
                            headers: {
                                session: destSession
                            },
                            json: userGroupFromFile,
                            responseType: 'json'
                        }, allowSelfSignedCerts, httpTimeout);
                    }

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

    static async retrieveUserGroupByName(groupName: string, allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, session: string): Promise<any> {
        const userGroupMap = await this.retrieveUserGroupMapByName(allowSelfSignedCerts, httpTimeout, fqdn, session);

        return userGroupMap[groupName];
    }

    static retrieveUserGroupMapByName(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, session: string): any {
        const p = new Promise<any>(async (resolve, reject) => {
            var userGroups: any = {};
            var userGroupData: [any];
            try {
                const body = await RestClient.get(`https://${fqdn}/api/v2/user_groups`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                OutputChannelLogging.log(`user groups retrieved`);
                userGroupData = body.data;
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving user groups`, err);
                return reject();
            }

            // create map
            userGroupData.forEach(userGroup => {
                userGroups[userGroup.name] = userGroup;
            });

            resolve(userGroups);
        });

        return p;
    }
}