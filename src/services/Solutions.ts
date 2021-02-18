/* eslint-disable @typescript-eslint/naming-convention */
import * as parser from 'fast-xml-parser';
import * as fs from 'fs';
import * as he from 'he';
import * as os from 'os';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectSolutionsInputs } from '../parameter-collection/solutions-parameters';
import { TaniumSolutionNodeProvider } from '../trees/TaniumSolutionNodeProvider';

import path = require('path');
import { DiffItemData, PathUtils } from '../common/pathUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { OpenType } from '../common/enums';
import { DiffBase } from './DiffBase';
import { collectSolutionsRefreshInputs } from '../parameter-collection/solutions-refresh-parameters';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareSolutions': () => {
            Solutions.processUserSolutions(context);
        },
        'hoganslendertanium.refreshSolutions': () => {
            Solutions.refreshUserSolutions(context);
        },
        'hoganslendertanium.clearSolutions': () => {
            Solutions.clearUserSolutions(context);
        },
        'hoganslendertanium.analyzeSolutions': (label, diffItems) => {
            Solutions.analyzeSolutions(label, diffItems, context);
        },
    });
}

export interface SolutionData {
    fqdn: FqdnSetting,
    items: SolutionItemData[]
}

export interface SolutionItemData {
    solution_id: string,
    name: string,
    current_version: string,
    available_version: string,
    content_url: string,
    featured: boolean,
}

export class Solutions extends DiffBase {
    static async analyzeSolutions(label: string, diffItems: DiffItemData, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        OutputChannelLogging.log(`calculating ${label} differences`);

        const panels = this.createSolutionPanels(label, diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        OutputChannelLogging.log(`missing ${label.toLowerCase()}: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified ${label.toLowerCase()}: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`unchanged ${label.toLowerCase()}: ${diffItems.unchanged.length}`);

        const title = label;

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            readOnly: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            readOnly: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

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
    }

    static async clearUserSolutions(context: vscode.ExtensionContext) {
        TaniumSolutionNodeProvider.currentProvider?.clearSolutionData();
    }

    static async refreshUserSolutions(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectSolutionsRefreshInputs(config, context);

        // collect values
        const leftFqdn: FqdnSetting = TaniumSolutionNodeProvider.currentProvider?.getSolutionDataFqdn()!;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn.label}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: leftFqdn,
                username: leftUsername,
                password: leftPassword
            }
        ])) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Solution Retrieval',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 100;

            progress.report({ increment: increment, message: `solutions retrieval from ${leftFqdn.label}` });
            await this.refreshSolutions(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });
    }

    static async processUserSolutions(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectSolutionsInputs(config, context);

        // collect values
        const leftFqdn: FqdnSetting = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn.label}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: leftFqdn,
                username: leftUsername,
                password: leftPassword
            }
        ])) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Solution Retrieval',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 100;

            progress.report({ increment: increment, message: `solutions retrieval from ${leftFqdn.label}` });
            await this.processSolutions(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });
    }

    static refreshSolutions(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // clear items
                TaniumSolutionNodeProvider.currentProvider?.refreshSolutionData();

                // get session
                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                var body = await RestClient.get(`${restBase}/solutions`, {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                // iterate through data
                const solutionData: any = {};
                body.data.forEach((solution: any) => {
                    solutionData[solution.solution_id] = {
                        solution_id: solution.solution_id,
                        name: solution.name,
                        current_version: solution.imported_version,
                        available_version: '',
                        content_url: '',
                        featured: false,
                    };
                });

                // get server info
                body = await RestClient.get(`${restBase}/server_info`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                // get server version
                const serverVersion: string = body.data.Diagnostics.Settings.Version;

                // get major and minor
                var versionItems = serverVersion.split('.');

                const manifestUrl = `https://content.tanium.com/files/initialcontent/${versionItems[0]}${versionItems[1]}/manifest.xml`;

                // get file
                const filePath = path.join(os.tmpdir(), 'manifest.xml');
                await RestClient.downloadFile(manifestUrl, filePath, {}, allowSelfSignedCerts, httpTimeout);

                // convert xml to json
                fs.readFile(filePath, 'utf8', function (err, data) {
                    if (err) {
                        OutputChannelLogging.logError(`could not open '${filePath}'`, err);
                        return reject();
                    }

                    var xmlParsingOptions = {
                        attributeNamePrefix: "@_",
                        attrNodeName: "attr", //default is 'false'
                        textNodeName: "#text",
                        ignoreAttributes: true,
                        ignoreNameSpace: false,
                        allowBooleanAttributes: false,
                        parseNodeValue: true,
                        parseAttributeValue: false,
                        trimValues: true,
                        cdataTagName: "__cdata", //default is 'false'
                        cdataPositionChar: "\\c",
                        parseTrueNumberOnly: false,
                        arrayMode: false, //"strict"
                        attrValueProcessor: (val: string, attrName: string) => he.decode(val, { isAttributeValue: true }),//default is a=>a
                        tagValueProcessor: (val: string, tagName: string) => he.decode(val), //default is a=>a
                        stopNodes: ["parse-me-as-string"]
                    };

                    if (parser.validate(data) === true) { //optional (it'll return an object in case it's not valid)
                        var jsonObj = parser.parse(data, xmlParsingOptions);

                        // walk solutions
                        jsonObj.content_manifest.solution.forEach((solution: any) => {
                            // update solution with manifest data
                            const target: SolutionItemData = solutionData[solution.id];

                            if (target) {
                                // check for alternate name
                                if (solution.name_alternate) {
                                    target.name = solution.name_alternate;
                                }

                                // check for module
                                if (solution.install_config_enabled) {
                                    if (solution.featured === 1) {
                                        target.featured = true;
                                    }
                                }

                                target.available_version = solution.version;
                                target.content_url = solution.content_url;
                            }
                        });

                        // generate array
                        const solutionItems: SolutionItemData[] = [];
                        for (const property in solutionData) {
                            const target: SolutionItemData = solutionData[property];

                            if (target.available_version !== '') {
                                solutionItems.push(target);
                            }
                        }

                        solutionItems.sort((a: SolutionItemData, b: SolutionItemData) => (a.name > b.name) ? 1 : -1);

                        // update treeview
                        TaniumSolutionNodeProvider.currentProvider?.setSolutionData({
                            fqdn: fqdn,
                            items: solutionItems,
                        });

                        resolve();
                    }
                });
            } catch (err) {
                OutputChannelLogging.logError(`refreshing solutions`, err);
                return reject();
            }
        });

        return p;
    }

    static processSolutions(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                var body = await RestClient.get(`${restBase}/solutions`, {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                // iterate through data
                const solutionData: any = {};
                body.data.forEach((solution: any) => {
                    solutionData[solution.solution_id] = {
                        solution_id: solution.solution_id,
                        name: solution.name,
                        current_version: solution.imported_version,
                        available_version: '',
                        content_url: '',
                        featured: false,
                    };
                });

                // get server info
                body = await RestClient.get(`${restBase}/server_info`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                // get server version
                const serverVersion: string = body.data.Diagnostics.Settings.Version;

                // get major and minor
                var versionItems = serverVersion.split('.');

                const manifestUrl = `https://content.tanium.com/files/initialcontent/${versionItems[0]}${versionItems[1]}/manifest.xml`;

                // get file
                const filePath = path.join(os.tmpdir(), 'manifest.xml');
                await RestClient.downloadFile(manifestUrl, filePath, {}, allowSelfSignedCerts, httpTimeout);

                // convert xml to json
                fs.readFile(filePath, 'utf8', function (err, data) {
                    if (err) {
                        OutputChannelLogging.logError(`could not open '${filePath}'`, err);
                        return reject();
                    }

                    var xmlParsingOptions = {
                        attributeNamePrefix: "@_",
                        attrNodeName: "attr", //default is 'false'
                        textNodeName: "#text",
                        ignoreAttributes: true,
                        ignoreNameSpace: false,
                        allowBooleanAttributes: false,
                        parseNodeValue: true,
                        parseAttributeValue: false,
                        trimValues: true,
                        cdataTagName: "__cdata", //default is 'false'
                        cdataPositionChar: "\\c",
                        parseTrueNumberOnly: false,
                        arrayMode: false, //"strict"
                        attrValueProcessor: (val: string, attrName: string) => he.decode(val, { isAttributeValue: true }),//default is a=>a
                        tagValueProcessor: (val: string, tagName: string) => he.decode(val), //default is a=>a
                        stopNodes: ["parse-me-as-string"]
                    };

                    if (parser.validate(data) === true) { //optional (it'll return an object in case it's not valid)
                        var jsonObj = parser.parse(data, xmlParsingOptions);

                        // walk solutions
                        jsonObj.content_manifest.solution.forEach((solution: any) => {
                            // update solution with manifest data
                            const target: SolutionItemData = solutionData[solution.id];

                            if (target) {
                                // check for alternate name
                                if (solution.name_alternate) {
                                    target.name = solution.name_alternate;
                                }

                                // check for module
                                if (solution.install_config_enabled) {
                                    if (solution.featured === 1) {
                                        target.featured = true;
                                    }
                                }

                                target.available_version = solution.version;
                                target.content_url = solution.content_url;
                            }
                        });

                        // generate array
                        const solutionItems: SolutionItemData[] = [];
                        for (const property in solutionData) {
                            const target: SolutionItemData = solutionData[property];

                            if (target.available_version !== '') {
                                solutionItems.push(target);
                            }
                        }

                        solutionItems.sort((a: SolutionItemData, b: SolutionItemData) => (a.name > b.name) ? 1 : -1);

                        // update treeview
                        TaniumSolutionNodeProvider.currentProvider?.setSolutionData({
                            fqdn: fqdn,
                            items: solutionItems,
                        });

                        resolve();
                    }
                });
            } catch (err) {
                OutputChannelLogging.logError(`retrieving solutions`, err);
                return reject();
            }
        });

        return p;
    }
}