/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { WebContentUtils } from '../common/webContentUtils';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { ContentSetRoles } from './ContentSetRoles';
import { DiffBase } from './DiffBase';
import { UserGroups } from './UserGroups';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetUserGroupRoleMemberships': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetUserGroupRoleMemberships.analyzeContentSetUserGroupRoleMemberships(uris[0], uris[1], context);
        },
    });
}

export class ContentSetUserGroupRoleMemberships extends DiffBase {
    static async analyzeContentSetUserGroupRoleMemberships(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Content Set User Group Role Memberships',
            leftDir: left.fsPath,
            rightDir: right.fsPath,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeContentSetUserGroupRoleMemberships',
        }, context);

        const panels = this.createPanels('Content Set User Group Role Memberships', diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        OutputChannelLogging.log(`missing content set user group role memberships: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set user group role memberships: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set user group role memberships: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set user group role memberships: ${diffItems.unchanged.length}`);

        const title = 'Content Set Role Memberships';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
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

                        await this.transferContentSetUserGroupRoleMembership(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            message.name,
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
                        vscode.window.showInformationMessage("Selected content set role memberships have been migrated");
                        break;

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferContentSetUserGroupRoleMembership(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            message.name,
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

    static async transferContentSetUserGroupRoleMembership(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        destFqdn: any,
        username: any,
        password: any,
        filePath: any,
        targetFilePath: any,
        name: any) {

        const p = new Promise<void>(async (resolve, reject) => {
            OutputChannelLogging.initialize();

            // get data
            const dataFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            try {
                // get session
                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

                // get content set role
                const contentSetRole = await ContentSetRoles.retrieveContentSetRoleByName(dataFromFile.content_set_role.name, destFqdn, session, allowSelfSignedCerts, httpTimeout);

                // get user group map
                const userGroupMap = await UserGroups.retrieveUserGroupMapByName(allowSelfSignedCerts, httpTimeout, destFqdn, session);

                // generate json
                var newObject = {
                    content_set_role: {
                        id: contentSetRole.id,
                    },
                    user_group: {
                        id: userGroupMap[dataFromFile.user_group.name].id,
                    }
                };

                const data = await RestClient.post(`https://${destFqdn}/api/v2/content_set_user_group_role_memberships`, {
                    headers: {
                        session: session,
                    },
                    json: newObject,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                OutputChannelLogging.log(`importing content set user group role membership complete`);
                resolve();

            } catch (err) {
                OutputChannelLogging.logError('error importing content set user group role membership', err);
                reject();
            }
        });

        return p;
    }}