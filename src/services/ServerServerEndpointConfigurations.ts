/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { ServerServerBase } from './ServerServerBase';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { PathUtils } from '../common/pathUtils';
import { collectServerServerEnpdointConfiguratinInputs } from '../parameter-collection/server-server-endpoint-configurations-parameters';
import { TransformEndpointConfigurationItem } from '../transform/TransformEndpointConfigurationItem';
import { TransformEndpointConfigurationSetting } from '../transform/TranformEndpointConfigurationSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerEndpointConfigurations': () => {
            ServerServerEndpointConfigurations.processEndpointConfigurations(context);
        },
    });
}

export class ServerServerEndpointConfigurations extends ServerServerBase {
    static async processEndpointConfigurations(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        if (this.invalidWorkspaceFolders()) {
            return;
        }

        // get the current folder
        const folderPath = vscode.workspace.workspaceFolders![0];

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerEnpdointConfiguratinInputs(config, context);

        // collect values
        const leftFqdn: FqdnSetting = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: FqdnSetting = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn.label}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn.label}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: leftFqdn,
                username: leftUsername,
                password: leftPassword
            },
            {
                fqdn: rightFqdn,
                username: rightUsername,
                password: rightPassword
            }
        ])) {
            return;
        }

        // create folders
        const leftDir = path.join(folderPath.uri.fsPath, `1 - ${sanitize(leftFqdn.label)}%EndpointConfigurations`);
        const rightDir = path.join(folderPath.uri.fsPath, `2 - ${sanitize(rightFqdn.label)}%EndpointConfigurations`);

        // store for later
        TaniumDiffProvider.currentProvider?.addSolutionContentSetData({
            xmlContentSetFile: '',
            leftDir: leftDir,
            rightDir: rightDir,
        }, context);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Endpoint Configuration Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `endpoint configuration retrieval from ${leftFqdn.label}` });
            await this.processServerEndpointConfigurations(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `endpoint configuration retrieval from ${rightFqdn.label}` });
            await this.processServerEndpointConfigurations(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze endpoint configurations items
        await this.processDiffItems(leftDir, rightDir, 'Items', context);
        await this.processDiffItems(leftDir, rightDir, 'Settings', context);
    }

    static async processDiffItems(leftDir: string, rightDir: string, subDirName: string, context: vscode.ExtensionContext) {
        const targetLeftDir = path.join(leftDir, subDirName);
        const targetRightDir = path.join(rightDir, subDirName);

        const diffItems = await PathUtils.getDiffItems(targetLeftDir, targetRightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: `Endpoint Configurations: ${subDirName}`,
            leftDir: targetLeftDir,
            rightDir: targetRightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeModules',
        }, context);
    }

    static async processServerEndpointConfigurations(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        fqdn: FqdnSetting,
        username: string,
        password: string,
        directory: string,
        label: string
    ) {
        // get session
        var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

        // get items
        await this.processItems(allowSelfSignedCerts, httpTimeout, fqdn, session, directory, label);

        // get settings
        await this.processSettings(allowSelfSignedCerts, httpTimeout, fqdn, session, directory, label);
    }

    static processItems(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, session: string, directory: string, label: string) {
        const p = new Promise<void>(async (resolve, reject) => {
            const restBase = `https://${fqdn.fqdn}/plugin/products/endpoint-configuration/v1/config/items`;
            const subDirName = 'Items';
            const itemsSubDir = path.join(directory, subDirName);

            // verify sub dir
            if (!fs.existsSync(itemsSubDir)) {
                fs.mkdirSync(itemsSubDir);
            }

            OutputChannelLogging.log(`endpoint configuration items retrieval - initialized for ${fqdn.label}`);

            try {
                const body = await RestClient.post(restBase, {
                    headers: {
                        session: session
                    },
                    json: {
                        filters: [
                            {
                                domain: "endpoint-config",
                                data_category: "tools-install-settings"
                            }
                        ],
                        include_pending_changes: false,
                        apply_pending_reorders: false
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    cancellable: false
                }, async (innerProgress) => {
                    const items: any[] = body.items;
                    var itemCounter: number = 0;
                    var itemTotal: number = items.length;

                    innerProgress.report({
                        increment: 0
                    });

                    const innerIncrement = 100 / itemTotal;

                    for (var i = 0; i < itemTotal; i++) {
                        var endpointConfigurationItem = items[i].item;
                        const itemName = Object.keys(endpointConfigurationItem.metadata.map)[0];
                        const itemFile = path.join(itemsSubDir, `${itemName}.json`);

                        innerProgress.report({
                            increment: innerIncrement,
                            message: `${i + 1}/${items.length}: ${itemName}`
                        });

                        endpointConfigurationItem = TransformEndpointConfigurationItem.transform(endpointConfigurationItem);
                        const itemContent = JSON.stringify(endpointConfigurationItem, null, 2);

                        fs.writeFile(itemFile, itemContent, err => {
                            if (err) {
                                OutputChannelLogging.logError(`error writing ${itemFile} in processItems`, err);
                                return reject();
                            }

                            if (checkResolve(++itemCounter, itemTotal, 'endpoint configuration items', fqdn)) {
                                return resolve();
                            }
                        });
                    }

                    return resolve();
                });
            } catch (err) {
                OutputChannelLogging.logError(`error downloading endpoint configuration items from ${restBase}`, err);
                return reject();
            }
        });

        return p;
    }

    static processSettings(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, session: string, directory: string, label: string) {
        const p = new Promise<void>(async (resolve, reject) => {
            const restBase = `https://${fqdn.fqdn}/plugin/products/endpoint-configuration/v1/settings`;
            const subDirName = 'Settings';
            const settingsSubDir = path.join(directory, subDirName);

            // verify sub dir
            if (!fs.existsSync(settingsSubDir)) {
                fs.mkdirSync(settingsSubDir);
            }

            OutputChannelLogging.log(`endpoint configuration settings retrieval - initialized for ${fqdn.label}`);

            try {
                const body = await RestClient.post(restBase, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    cancellable: false
                }, async (innerProgress) => {
                    const settings: any = body;
                    var settingCounter: number = 0;
                    const settingKeys = Object.keys(settings);
                    var settingTotal: number = settingKeys.length;

                    innerProgress.report({
                        increment: 0
                    });

                    const innerIncrement = 100 / settingTotal;

                    for (var i = 0; i < settingTotal; i++) {
                        const settingName = settingKeys[i];
                        var setting = settings[settingName];
                        const settingFile = path.join(settingsSubDir, `${settingName}.json`);

                        innerProgress.report({
                            increment: innerIncrement,
                            message: `${i + 1}/${settingTotal}: ${settingName}`
                        });

                        setting = TransformEndpointConfigurationSetting.transform(settingName, setting);
                        const settingContent = JSON.stringify(setting, null, 2);

                        fs.writeFile(settingFile, settingContent, err => {
                            if (err) {
                                OutputChannelLogging.logError(`error writing ${settingFile} in processSettings`, err);
                                return reject();
                            }

                            if (checkResolve(++settingCounter, settingTotal, 'endpoint configuration settings', fqdn)) {
                                return resolve();
                            }
                        });
                    }

                    return resolve();
                });
            } catch (err) {
                OutputChannelLogging.logError(`error downloading endpoint configuration items from ${restBase}`, err);
                return reject();
            }
        });

        return p;
    }
}