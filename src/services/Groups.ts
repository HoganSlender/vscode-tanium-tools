/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { MrGroupType, OpenType } from "../common/enums";
import { OutputChannelLogging } from "../common/logging";
import { PathUtils } from '../common/pathUtils';
import { RestClient } from "../common/restClient";
import { Session } from '../common/session';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from "../types/signingKey";
import { UserGroups } from "./UserGroups";

import path = require('path');
import { SigningUtils } from '../common/signingUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeFilterGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Groups.analyzeGroups(uris[0], uris[1], 0, context);
        },
        'hoganslendertanium.analyzeActionGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Groups.analyzeGroups(uris[0], uris[1], 1, context);
        },
        'hoganslendertanium.analyzeActionGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Groups.analyzeGroups(uris[0], uris[1], 1, context);
        },
    });
}

export class Groups {
    static async analyzeGroups(left: vscode.Uri, right: vscode.Uri, targetGroupType: number, context: vscode.ExtensionContext) {        
        var title = 'Groups';


        switch(targetGroupType) {
            case 0:
                title = 'Filter Groups';
                break;

            case 1:
                title = 'Action Groups';
                break;
            
            case 2:
                title = 'Action Policy Groups';
                break;

            case 3:
                title = 'Ad Hoc Groups';
                break;

            case 4:
                title = 'Manual Groups';
                break;
        }

        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingGroups',
            `Missing ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedGroups',
            `Modified ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedGroups',
            `Created ${title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedGroups',
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

        const missingGroups = await this.filterGroupType(await PathUtils.getMissingItems(left.fsPath, right.fsPath), targetGroupType);
        const modifiedGroups = await this.filterGroupType(await PathUtils.getModifiedItems(left.fsPath, right.fsPath), targetGroupType);
        const createdGroups = await this.filterGroupType(await PathUtils.getCreatedItems(left.fsPath, right.fsPath), targetGroupType);
        const unchangedGroups = await this.filterGroupType(await PathUtils.getUnchangedItems(left.fsPath, right.fsPath), targetGroupType);

        OutputChannelLogging.log(`missing groups: ${missingGroups.length}`);
        OutputChannelLogging.log(`modified groups: ${modifiedGroups.length}`);
        OutputChannelLogging.log(`created groups: ${createdGroups.length}`);
        OutputChannelLogging.log(`unchanged groups: ${unchangedGroups.length}`);

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: missingGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: modifiedGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            showSigningKeys: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: createdGroups,
            transferIndividual: 1,
            showServerInfo: 1,
            showSigningKeys: true,
            openType: OpenType.file,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: unchangedGroups,
            transferIndividual: 0,
            showServerInfo: 0,
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
                        vscode.window.showInformationMessage("Selected groups have been migrated");
                        break;

                    case 'transferItem':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferGroup(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
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
                        vscode.window.showInformationMessage("Selected groups have been migrated");
                        break;

                    case 'transferItem':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferGroup(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
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

    static async transferGroup(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        destFqdn: string,
        username: string,
        password: string,
        filePath: string,
        targetFilePath: string,
        signingKey: SigningKey,
        groupName: string
    ) {
        const p = new Promise(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get group data from file
                const groupFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                // generate import json
                const importJson = {
                    object_list: groupFromFile,
                    version: 2
                };

                // get signed content
                const signedContentData = await SigningUtils.retrieveSignedContent(importJson, signingKey);
                const signedContent = signedContentData.content;
                const tempPath = signedContentData.path;

                try {
                    // get session
                    const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

                    // import group
                    OutputChannelLogging.log(`importing ${groupName} into ${destFqdn}`);

                    const postSignedContentResult = await SigningUtils.postSignedContent(destFqdn, session, signedContent, allowSelfSignedCerts, httpTimeout);

                    // delete package temp file
                    fs.unlinkSync(tempPath);

                    if (!postSignedContentResult.success) {
                        OutputChannelLogging.log(`error in transferGroup: ${postSignedContentResult.exception}`);
                        return reject();
                    } else {
                        OutputChannelLogging.log(`importing ${groupName} complete`);

                        // create the missing file
                        const targetContents = fs.readFileSync(filePath, 'utf-8');
                        fs.writeFileSync(targetFilePath, targetContents);
                    }
                } catch (err) {
                    OutputChannelLogging.logError('error retrieving session', err);
                    reject();
                }

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring groups', err);
                reject();
            }
        });

        return p;
    }

    static getGroupByName(groupName: string, allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups/by-name/${groupName}`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                resolve(body.data);

            } catch (err) {
                OutputChannelLogging.logError(`error retrieving group`, err);
                reject();
            }
        });

        return p;
    }

    static getGroupById(groupId: string, allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups/${groupId}`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                resolve(body.data);

            } catch (err) {
                OutputChannelLogging.logError(`error retrieving group`, err);
                reject();
            }
        });

        return p;
    }

    static getGroupExportByNames(groupNames: string[], allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.post(`${restBase}/export`, {
                    headers: {
                        session: session
                    },
                    json: {
                        groups: {
                            include: groupNames
                        }
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                resolve(body.data);

            } catch (err) {
                OutputChannelLogging.logError(`error retrieving group`, err);
                reject();
            }
        });

        return p;
    }

    static setUpMrGroupInDest(
        sourceGroupName: string,
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        sourceFqdn: string,
        sourceSession: string,
        destFqdn: string,
        destSession: string,
        signingKey: SigningKey,
        groupType: MrGroupType,
        sourceName: string
    ): Promise<number> {
        const p = new Promise<number>(async (resolve, reject) => {
            try {
                const sourceRestBase = `https://${sourceFqdn}/api/v2`;
                const destRestBase = `https://${destFqdn}/api/v2`;

                // check for mrgroup_
                if (sourceGroupName.startsWith('mrgroup_')) {
                    // process mrgroup_
                    switch (groupType) {
                        case MrGroupType.user:
                            break;

                        case MrGroupType.userGroup:
                            // get original userGroup
                            const userGroup = await UserGroups.retrieveUserGroupByName(sourceName, allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceSession);

                            // get group
                            const mrGroup = await this.getGroupById(userGroup.group.id, allowSelfSignedCerts, httpTimeout, sourceRestBase, sourceSession);

                            // iterate through sub_groups and get names
                            const subGroupNames: string[] = [];
                            for (var i = 0; i < mrGroup.sub_groups.length; i++) {
                                var name = mrGroup.sub_groups[i].name;
                                subGroupNames.push(name);
                            }

                            // get group export
                            const groupExport = await this.getGroupExportByNames(subGroupNames, allowSelfSignedCerts, httpTimeout, sourceRestBase, sourceSession);

                            // sign content
                            const signingData = await SigningUtils.retrieveSignedContent(groupExport, signingKey);

                            // import data
                            const res = await SigningUtils.postSignedContent(destFqdn, destSession, signingData.content, allowSelfSignedCerts, httpTimeout);

                            // delete temp file
                            fs.unlinkSync(signingData.path);

                            // get dest groups
                            const destGroupMap = await this.getGroupMapByName(allowSelfSignedCerts, httpTimeout, destRestBase, destSession);

                            // generate update name for group
                            var ids: string[] = [];
                            const subGroupArray: any[] = [];
                            for (var i = 0; i < mrGroup.sub_groups.length; i++) {
                                const subGroup = mrGroup.sub_groups[i];
                                ids.push(String(destGroupMap[subGroup.name].id));
                                subGroupArray.push({
                                    id: destGroupMap[subGroup.name].id
                                });
                            }

                            // sort ids
                            ids.sort();

                            // generate string
                            var newGroupName = 'mrgroup_' + ids.join();

                            // update mrGroup to import
                            mrGroup.name = newGroupName;

                            // kill id
                            delete mrGroup.id;

                            // set sub_groups
                            mrGroup.sub_groups = subGroupArray;

                            // insert into target
                            var groupRes: any = await RestClient.post(`${destRestBase}/groups`, {
                                headers: {
                                    session: destSession
                                },
                                json: mrGroup,
                                responseType: 'json',
                            }, allowSelfSignedCerts, httpTimeout);

                            // return target group's id
                            resolve(groupRes.id);
                            break;
                    }
                } else {
                    // single group, see if it exists on target
                    try {
                        const targetGroup = await this.getGroupByName(sourceGroupName, allowSelfSignedCerts, httpTimeout, destRestBase, destSession);

                        // return target group's id
                        resolve(targetGroup.id);
                    } catch {
                        // doesn't exist, need to create it
                        const newTargetGroupJson = await this.getGroupExportByNames([sourceGroupName], allowSelfSignedCerts, httpTimeout, sourceRestBase, sourceSession);

                        // sign content
                        const signingData = await SigningUtils.retrieveSignedContent(newTargetGroupJson, signingKey);

                        // import data
                        const res = await SigningUtils.postSignedContent(destFqdn, destSession, signingData.content, allowSelfSignedCerts, httpTimeout);

                        // resolve
                        const targetGroup = await this.getGroupByName(sourceGroupName, allowSelfSignedCerts, httpTimeout, destRestBase, destSession);

                        // return target group's id
                        resolve(targetGroup.id);
                    }
                }

                resolve(-1);
            } catch (err) {
                OutputChannelLogging.logError(`error setting up group in target server`, err);
                reject();
            }
        });

        return p;
    }

    static getGroupMapByName(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);


                var groups: any = {};
                for (var i = 0; i < body.data.length; i++) {
                    const groupEntity: any = body.data[i];
                    groups[groupEntity.name] = groupEntity;
                }

                resolve(groups);
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving groups`, err);
                return reject();
            }
        });

        return p;
    }

    static getGroupMapById(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);


                var groups: any = {};
                for (var i = 0; i < body.data.length; i++) {
                    const groupEntity: any = body.data[i];
                    groups[groupEntity.id] = groupEntity;
                }

                resolve(groups);
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving groups`, err);
                return reject();
            }
        });

        return p;
    }

    static filterGroupType(fileInfos: any[], targetGroupType: number) {
        const p = new Promise<any[]>((resolve, reject) => {
            try {
                const retval: any[] = [];

                for (var i = 0; i < fileInfos.length; i++) {
                    const fileInfo: any = fileInfos[i];

                    // load group
                    const items = fileInfo.path.split('~');

                    const contents: string = fs.readFileSync(items[0], 'utf-8');

                    const groupInfo = JSON.parse(contents);

                    // access first group
                    const group = groupInfo.groups[0];

                    // check type
                    if (group.type === targetGroupType) {
                        retval.push(fileInfo);
                    }
                }

                resolve(retval);
            } catch (err) {
                OutputChannelLogging.logError(`error in filterGroupType`, err);
                reject();
            }
        });

        return p;
    }
}