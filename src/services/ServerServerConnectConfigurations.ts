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
import { TransformConnect } from '../transform/TransformConnect';
import { collectServerServerConnectConfigurationInputs } from '../parameter-collection/server-server-connect-configurations-parameters';
import { PathUtils } from '../common/pathUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerConnectConfigurations': () => {
            ServerServerConnectConfigurations.processConnectConfigurations(context);
        },
    });
}

export class ServerServerConnectConfigurations extends ServerServerBase {
    static async processConnectConfigurations(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerConnectConfigurationInputs(config, context);

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
        const leftDir = path.join(folderPath.uri.fsPath, `1 - ${sanitize(leftFqdn.label)}%ConnectConfigurations`);
        const rightDir = path.join(folderPath.uri.fsPath, `2 - ${sanitize(rightFqdn.label)}%ConnectConfigurations`);

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
            title: 'Connect Configuration Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `endpoint configuration retrieval from ${leftFqdn.label}` });
            await this.processServerConnectConfigurations(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `endpoint configuration retrieval from ${rightFqdn.label}` });
            await this.processServerConnectConfigurations(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        await this.processDiffItems(leftDir, rightDir, 'Settings', context);
        await this.processDiffItems(leftDir, rightDir, 'Connections', context);
    }

    static async processDiffItems(leftDir: string, rightDir: string, subDirName: string, context: vscode.ExtensionContext) {
        const targetLeftDir = path.join(leftDir, subDirName);
        const targetRightDir = path.join(rightDir, subDirName);

        const diffItems = await PathUtils.getDiffItems(targetLeftDir, targetRightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: `Connect: ${subDirName}`,
            leftDir: targetLeftDir,
            rightDir: targetRightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeConnect',
            useLabel: true
        }, context);
    }

    static async processServerConnectConfigurations(
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

        // get settings
        await this.processSettings(allowSelfSignedCerts, httpTimeout, fqdn, session, directory, label);

        // get connections
        await this.processConnections(allowSelfSignedCerts, httpTimeout, fqdn, session, directory, label);
    }

    static processSettings(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        fqdn: FqdnSetting,
        session: string,
        directory: string,
        label: string
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            const restBase = `https://${fqdn.fqdn}/plugin/products/connect/v1/settings`;

            try {
                const subDirName = 'Settings';
                const settingsSubDir = path.join(directory, subDirName);

                // verify sub dir
                if (!fs.existsSync(settingsSubDir)) {
                    fs.mkdirSync(settingsSubDir);
                }

                OutputChannelLogging.log(`connect settings retrieval - initialized for ${fqdn.label}`);

                const body = await RestClient.get(restBase, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                var settings: any = body;

                const settingsFile = path.join(settingsSubDir, 'settings.json');

                settings = TransformConnect.transformSettings(settings);
                const settingsContent = JSON.stringify(settings, null, 2);

                fs.writeFile(settingsFile, settingsContent, err => {
                    if (err) {
                        OutputChannelLogging.logError(`error writing ${settingsFile} in processSettings`, err);
                        return reject();
                    }

                    return resolve();
                });
            } catch (err) {
                OutputChannelLogging.logError(`error downloading connect configuration settings from ${restBase}`, err);
                return reject();
            }
        });

        return p;
    }

    static processConnections(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        fqdn: FqdnSetting,
        session: string,
        directory: string,
        label: string
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            const restBase = `https://${fqdn.fqdn}/plugin/products/connect/private/connections?skipComponentHydration=true`;
            const subDirName = 'Connections';
            const connectionsSubDir = path.join(directory, subDirName);

            // verify sub dir
            if (!fs.existsSync(connectionsSubDir)) {
                fs.mkdirSync(connectionsSubDir);
            }

            OutputChannelLogging.log(`connect connections retrieval - initialized for ${fqdn.label}`);

            try {
                const body = await RestClient.get(restBase, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    cancellable: false
                }, async (innerProgress) => {
                    const connections: any = body.data;
                    var connectionCounter: number = 0;
                    var connectionTotal: number = connections.length;

                    innerProgress.report({
                        increment: 0
                    });

                    const innerIncrement = 100 / connectionTotal;

                    if (connectionTotal === 0) {
                        OutputChannelLogging.log(`there are 0 connections for ${fqdn.label}`);
                        return resolve();
                    } else {
                        for (var i = 0; i < connectionTotal; i++) {
                            var connection = connections[i];
                            var connectionId = connection.id;
                            const connectionFile = path.join(connectionsSubDir, `${sanitize(connection.name)}.json`);

                            innerProgress.report({
                                increment: innerIncrement,
                                message: `${i + 1}/${connectionTotal}: ${connection.name}`
                            });

                            // retrieve export
                            const body = await RestClient.post(`https://${fqdn.fqdn}/plugin/products/connect/v1/export`, {
                                headers: {
                                    session: session,
                                },
                                json: [connectionId],
                                responseType: 'json',
                            }, allowSelfSignedCerts, httpTimeout);

                            var connectionExport = body[0];

                            connectionExport = TransformConnect.transformConnection(connectionExport);
                            const connectionContent = JSON.stringify(connectionExport, null, 2);

                            fs.writeFile(connectionFile, connectionContent, err => {
                                if (err) {
                                    OutputChannelLogging.logError(`error writing ${connectionFile} in processConnections`, err);
                                    return reject();
                                }

                                if (checkResolve(++connectionCounter, connectionTotal, 'connect connections', fqdn)) {
                                    return resolve();
                                }
                            });
                        }
                    }
                });
            } catch (err) {
                OutputChannelLogging.logError(`error downloading connect connections from ${restBase}`, err);
                return reject();
            }
        });

        return p;
    }
}
