/* eslint-disable @typescript-eslint/naming-convention */
import * as he from 'he';
import * as parser from 'fast-xml-parser';
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';
import * as os from 'os';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { Groups } from './Groups';
import { UserGroups } from './UserGroups';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { collectSolutionsInputs } from '../parameter-collection/solutions-parameters';
import { version } from 'he';
import { TaniumTreeItem } from '../trees/TaniumTreeItem';
import { TaniumNodeProvider } from '../trees/TaniumNodeProvider';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareSolutions': () => {
            Solutions.processUserSolutions(context);
        }
    });
}

export interface SolutionItemData {
    solution_id: string,
    name: string,
    current_version: string,
    available_version: string,
    content_url: string,
    featured: boolean,
}

export class Solutions {
    static async processUserSolutions(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectSolutionsInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);


        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Solution Retrieval',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `solutions retrieval from ${leftFqdn}` });
            await this.processSolutions(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });
    }

    static processSolutions(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string) {
        const restBase = `https://${fqdn}/api/v2`;

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
                        TaniumNodeProvider.currentProvider?.setSolutionItems(solutionItems);
                        TaniumNodeProvider.currentProvider?.refresh();

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