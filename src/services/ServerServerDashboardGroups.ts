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
import { collectServerServerDashboardGroupInputs } from '../parameter-collection/server-server-dashboard-group-parameters';
import { DashboardGroups } from './DashboardGroups';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { PathUtils } from '../common/pathUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerDashboardGroups': () => {
            ServerServerDashboardGroups.processDashboardGroups(context);
        },
    });
}

export class ServerServerDashboardGroups extends ServerServerBase {
    static async processDashboardGroups(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerDashboardGroupInputs(config, context);

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

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%DashboardGroups`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%DashboardGroups`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dashboard Group Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `dashboard group retrieval from ${leftFqdn.label}` });
            await this.processServerDashboardGroups(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `dashboard group retrieval from ${rightFqdn.label}` });
            await this.processServerDashboardGroups(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze dashboard groups
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Dashboard Groups',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeDashboardGroups',
        }, context);

        DashboardGroups.analyzeDashboardGroups(diffItems, context);
    }
    static processServerDashboardGroups(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`dashboard group retrieval - initialized for ${fqdn.label}`);
                    var dashboard_groups: [any];

                    // get dashboard groups
                    try {
                        const body = await RestClient.post(`${restBase}/export`, {
                            headers: {
                                session: session,
                            },
                            json: {
                                "dashboard_groups": {
                                    "include_all": true,
                                }
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`dashboard group retrieval - complete for ${fqdn.label}`);
                        dashboard_groups = body.data.object_list.dashboard_groups;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving dashboard groups from ${fqdn.label}`, err);
                        return reject(`retrieving content_sets from ${fqdn.label}`);
                    }

                    // iterate through each download export
                    var dashboardGroupCounter: number = 0;
                    var dashboardGroupTotal: number = dashboard_groups.length;

                    if (dashboardGroupTotal === 0) {
                        OutputChannelLogging.log(`there are 0 dashboard groups for ${fqdn.label}`);
                        resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({
                                increment: 0
                            });

                            const innerIncrement = 100 / dashboard_groups.length;

                            for (var i = 0; i < dashboard_groups.length; i++) {
                                const dashboardGroup = dashboard_groups[i];

                                innerProgress.report({
                                    increment: innerIncrement,
                                    message: `${i + 1}/${dashboard_groups.length}: ${dashboardGroup.name}`
                                });
    
                                if (dashboardGroup.deleted_flag === 1) {
                                    if (checkResolve(++dashboardGroupCounter, dashboardGroupTotal, 'dashboard groups', fqdn)) {
                                        return resolve();
                                    }
                                } else {
                                    // get export
                                    try {
                                        const dashboardGroupName: string = sanitize(dashboardGroup.name);
    
                                        try {
                                            const content: string = JSON.stringify(dashboardGroup, null, 2);
    
                                            const dashboardGroupFile = path.join(directory, dashboardGroupName + '.json');
                                            fs.writeFile(dashboardGroupFile, content, (err) => {
                                                if (err) {
                                                    OutputChannelLogging.logError(`could not write ${dashboardGroupFile}`, err);
                                                }
                                            });
    
                                            if (checkResolve(++dashboardGroupCounter, dashboardGroupTotal, 'dashboard groups', fqdn)) {
                                                return resolve();
                                            }
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} dashboard group ${dashboardGroupName}`, err);
    
                                            if (checkResolve(++dashboardGroupCounter, dashboardGroupTotal, 'dashboard groups', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`saving dashboard group file for ${dashboardGroup.name} from ${fqdn.label}`, err);
    
                                        if (checkResolve(++dashboardGroupCounter, dashboardGroupTotal, 'dashboard groups', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }
                            });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading dashboard groups from ${restBase}`, err);
                return reject(`error downloading dashboard groups from ${restBase}`);
            }
        });

        return p;
    }
}