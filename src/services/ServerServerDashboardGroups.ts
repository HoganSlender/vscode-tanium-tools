/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerContentSetInputs } from '../parameter-collection/server-server-content-sets-parameters';
import { ContentSets } from './ContentSets';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { collectServerServerDashboardGroupInputs } from '../parameter-collection/server-server-dashboard-group-parameters';
import { DashboardGroups } from './DashboardGroups';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerDashboardGroups': () => {
            ServerServerDashboardGroups.processDashboardGroups(context);
        },
    });
}

export class ServerServerDashboardGroups {
    static async processDashboardGroups(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerDashboardGroupInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        const rightFqdn: string = state.rightFqdn;
        const rightUsername: string = state.rightUsername;
        const rightPassword: string = state.rightPassword;


        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`right fqdn: ${rightFqdn}`);
        OutputChannelLogging.log(`right username: ${rightUsername}`);
        OutputChannelLogging.log(`right password: XXXXXXXX`);

        // create folders
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%DashboardGroups`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%DashboardGroups`);

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

            progress.report({ increment: increment, message: `dashboard group retrieval from ${leftFqdn}` });
            await this.processServerDashboardGroups(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `dashboard group retrieval from ${rightFqdn}` });
            await this.processServerDashboardGroups(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze dashboard groups
        DashboardGroups.analyzeDashboardGroups(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }
    static processServerDashboardGroups(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`dashboard group retrieval - initialized for ${fqdn}`);
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

                        OutputChannelLogging.log(`dashboard group retrieval - complete for ${fqdn}`);
                        dashboard_groups = body.data.object_list.dashboard_groups;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving dashboard groups from ${fqdn}`, err);
                        return reject(`retrieving content_sets from ${fqdn}`);
                    }

                    // iterate through each download export
                    var dashboardGroupCounter: number = 0;
                    var dashboardGroupTotal: number = dashboard_groups.length;

                    if (dashboardGroupTotal === 0) {
                        OutputChannelLogging.log(`there are 0 dashboard groups for ${fqdn}`);
                        resolve();
                    } else {
                        var i = 0;

                        dashboard_groups.forEach(dashboardGroup => {
                            i++;

                            if (i % 30 === 0 || i === dashboardGroupTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${dashboardGroupTotal}`);
                            }

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
                                    OutputChannelLogging.logError(`saving dashboard group file for ${dashboardGroup.name} from ${fqdn}`, err);

                                    if (checkResolve(++dashboardGroupCounter, dashboardGroupTotal, 'dashboard groups', fqdn)) {
                                        return resolve();
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