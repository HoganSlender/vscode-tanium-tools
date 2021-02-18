/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import { checkResolve } from '../common/checkResolve';
import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerDashboardInputs } from '../parameter-collection/server-server-dashboard-parameters';
import { Dashboards } from './Dashboards';
import { ServerServerBase } from './ServerServerBase';

import path = require('path');
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { PathUtils } from '../common/pathUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerDashboards': () => {
            ServerServerDashboards.processDashboards(context);
        },
    });
}

class ServerServerDashboards extends ServerServerBase {
    static async processDashboards(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        if (this.invalidWorkspaceFolders()) {
            return;
        }

        // get the current folder
        const folderPath = vscode.workspace.workspaceFolders![0].uri.fsPath;

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerDashboardInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%Dashboards`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%Dashboards`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dashboards Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `dashboard retrieval from ${leftFqdn.label}` });
            await this.processServerDashboards(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `dashboard retrieval from ${rightFqdn.label}` });
            await this.processServerDashboards(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze dashboards
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Dashboards',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeDashboards',
        }, context);

        Dashboards.analyzeDashboards(diffItems, context);
    }

    static processServerDashboards(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`dashboard retrieval - initialized for ${fqdn.label}`);
                    var dashboards: [any];

                    // get dashboards
                    try {
                        const body = await RestClient.get(`${restBase}/dashboards`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`dashboard retrieval - complete for ${fqdn.label}`);
                        dashboards = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving dashboards from ${fqdn.label}`, err);
                        return reject(`retrieving dashboards from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var dashboardCounter: number = 0;
                    var dashboardTotal: number = dashboards.length;

                    if (dashboardTotal === 0) {
                        OutputChannelLogging.log(`there are 0 dashboards for ${fqdn.label}`);
                        return resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({
                                increment: 0
                            });

                            const innerIncrement = 100 / dashboards.length;

                            for (var i = 0; i < dashboards.length; i++) {
                                const dashboard = dashboards[i];

                                innerProgress.report({
                                    increment: innerIncrement,
                                    message: `${i + 1}/${dashboards.length}: ${dashboard.name}`
                                });

                                if (dashboard.deleted_flag === 1) {
                                    if (checkResolve(++dashboardCounter, dashboardTotal, 'dashboards', fqdn)) {
                                        return resolve();
                                    }
                                } else {
                                    // get export
                                    try {
                                        const body = await RestClient.post(`${restBase}/export`, {
                                            headers: {
                                                session: session,
                                            },
                                            json: {
                                                dashboards: {
                                                    include: [
                                                        dashboard.name
                                                    ]
                                                }
                                            },
                                            responseType: 'json',
                                        }, allowSelfSignedCerts, httpTimeout);

                                        const taniumDashboard: any = body.data.object_list.dashboards[0];
                                        const dashboardName: string = sanitize(taniumDashboard.name);

                                        try {
                                            const content: string = JSON.stringify(taniumDashboard, null, 2);

                                            const dashboardFile = path.join(directory, dashboardName + '.json');
                                            fs.writeFile(dashboardFile, content, (err) => {
                                                if (err) {
                                                    OutputChannelLogging.logError(`could not write ${dashboardFile}`, err);
                                                }

                                                if (checkResolve(++dashboardCounter, dashboardTotal, 'dashboards', fqdn)) {
                                                    return resolve();
                                                }
                                            });
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} dashboard ${dashboardName}`, err);

                                            if (checkResolve(++dashboardCounter, dashboardTotal, 'dashboards', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`retrieving dashboardExport for ${dashboard.name} from ${fqdn.label}`, err);

                                        if (checkResolve(++dashboardCounter, dashboardTotal, 'dashboards', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading dashboards from ${restBase}`, err);
                return reject(`error downloading dashboards from ${restBase}`);
            }
        });

        return p;
    }
}