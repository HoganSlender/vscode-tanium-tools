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
import { ContentSetRoles } from './ContentSetRoles';
import { Users } from './Users';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRoleMemberships': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetRoleMemberships.analyzeContentSetRoleMemberships(uris[0], uris[1], context);
        },
    });
}

export class ContentSetRoleMemberships {
    static async analyzeContentSetRoleMemberships(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingContentSetRolememberships',
            'Missing Content Set Role Memberships',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedContentSetRoleMemberships',
            'Modified Content Set Role Memberships',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedContentSetRoleMemberships',
            'Created Content Set Role Memberships',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedContentSetRoleMemberships',
            'Unchanged Content Set Role Memberships',
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
        OutputChannelLogging.log(`missing content set role memberships: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified content set role memberships: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created content set role memberships: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged content set role memberships: ${diffItems.unchanged.length}`);

        const title = 'Content Set Role Memberships';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 1,
            showServerInfo: 1,
            showDestServer: true,
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

                        await this.transferContentSetRoleMembership(
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
                        vscode.window.showInformationMessage("Selected content set role memberships have been migrated");
                        break;

                    case 'transferItem':
                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferContentSetRoleMembership(
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

    static async transferContentSetRoleMembership(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        destFqdn: any,
        username: any,
        password: any,
        filePath: any,
        targetFilePath: any,
        name: any) {

        const p = new Promise(async (resolve, reject) => {
            OutputChannelLogging.initialize();

            // get data
            const dataFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            try {
                // get session
                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

                // get content set role
                const contentSetRole = await ContentSetRoles.retrieveContentSetRoleByName(dataFromFile.content_set_role.name, destFqdn, session, allowSelfSignedCerts, httpTimeout);

                // get user map
                const userMap = await Users.retrieveUserMapByName(allowSelfSignedCerts, httpTimeout, destFqdn, session);

                // generate json
                var newObject = {
                    content_set_role: {
                        id: contentSetRole.id,
                    },
                    user: {
                        id: userMap[dataFromFile.user.name].id,
                    }
                };

                const data = await RestClient.post(`https://${destFqdn}/api/v2/content_set_role_memberships`, {
                    headers: {
                        session: session,
                    },
                    json: newObject,
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                OutputChannelLogging.log(`importing content set role membership complete`);
                resolve();

            } catch (err) {
                OutputChannelLogging.logError('error importing content set role membership', err);
                reject();
            }
        });

        return p;
    }
}
