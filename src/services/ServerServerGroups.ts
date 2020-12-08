/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';

import path = require('path');
import { collectServerServerGroupInputs } from '../parameter-collection/server-server-group-parameters';
import { Groups } from './Groups';
import { checkResolve } from '../common/checkResolve';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerFilterGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerGroups.processGroups(0, context);
        },
        'hoganslendertanium.compareServerServerActionGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerGroups.processGroups(1, context);
        },
        'hoganslendertanium.compareServerServerActionPolicyGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerGroups.processGroups(2, context);
        },
        'hoganslendertanium.compareServerServerAdHocGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerGroups.processGroups(3, context);
        },
        'hoganslendertanium.compareServerServerManualGroups': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerGroups.processGroups(4, context);
        },
    });
}

class ServerServerGroups {
    static async processGroups(targetGroupType: number, context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerGroupInputs(config, context);

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
        var folderLabel = '%Groups';

        switch (targetGroupType) {
            case 0:
                folderLabel = '%FilterGroups';
                break;

            case 1:
                folderLabel = '%ActionGroups';
                break;

            case 2:
                folderLabel = '%ActionPolicyGroups';
                break;

            case 3:
                folderLabel = '%AdHocGroups';
                break;

            case 4:
                folderLabel = '%ManualGroups';
                break;
        }

        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}${folderLabel}`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}${folderLabel}`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Group Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `group retrieval from ${leftFqdn}` });
            await this.processServerGroups(allowSelfSignedCerts, httpTimeout, targetGroupType, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `group retrieval from ${rightFqdn}` });
            await this.processServerGroups(allowSelfSignedCerts, httpTimeout, targetGroupType, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze groups
        Groups.analyzeGroups(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), targetGroupType, context);
    }

    static processServerGroups(allowSelfSignedCerts: boolean, httpTimeout: number, targetGroupType: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`group retrieval - initialized for ${fqdn}`);
                    var groups: [any];

                    // get groups
                    try {
                        const options: any = {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        };
                        options.headers['tanium-options'] = `{"cache_filters":[{"field":"type","operator":"Equal","value":"${targetGroupType}"}]}`;

                        const body = await RestClient.get(`${restBase}/groups`, options, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`group retrieval - complete for ${fqdn}`);
                        groups = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving groups from ${fqdn}`, err);
                        return reject(`retrieving groups from ${fqdn}`);
                    }

                    // remove cache object
                    groups.pop();

                    // iterate through each download export
                    var groupCounter: number = 0;
                    var groupTotal: number = groups.length;

                    if (groupTotal === 0) {
                        OutputChannelLogging.log(`there are 0 groups for ${fqdn}`);
                        return resolve();
                    } else {
                        var i = 0;

                        groups.forEach(async group => {
                            i++;

                            if (i % 30 === 0 || i === groupTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${groupTotal}`);
                            }

                            if (group.deleted_flag) {
                                if (checkResolve(++groupCounter, groupTotal, 'groups', fqdn)) {
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
                                            groups: {
                                                include: [
                                                    group.name
                                                ]
                                            }
                                        },
                                        responseType: 'json',
                                    }, allowSelfSignedCerts, httpTimeout);

                                    const taniumGroup: any = body.data.object_list.groups[0];
                                    const groupName: string = sanitize(taniumGroup.name);

                                    try {
                                        const content: string = JSON.stringify(body.data.object_list, null, 2);

                                        const groupFile = path.join(directory, groupName + '.json');
                                        fs.writeFile(groupFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${groupFile}`, err);
                                            }

                                            if (checkResolve(++groupCounter, groupTotal, 'groups', fqdn)) {
                                                return resolve();
                                            }
                                        });
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} group ${groupName}`, err);

                                        if (checkResolve(++groupCounter, groupTotal, 'groups', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`retrieving groupExport for ${group.name} from ${fqdn}`, err);

                                    if (checkResolve(++groupCounter, groupTotal, 'groups', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading groups from ${restBase}`, err);
                return reject(`error downloading groups from ${restBase}`);
            }
        });

        return p;
    }
}
