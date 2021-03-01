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
import { collectServerServerSavedActionInputs } from '../parameter-collection/server-server-saved-actions-parameters';
import { SavedActions } from './SavedActions';
import { PathUtils } from '../common/pathUtils';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSavedActions': () => {
            ServerServerSavedActions.processSavedActions(context);
        },
    });
}

export class ServerServerSavedActions extends ServerServerBase {
    static async processSavedActions(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerSavedActionInputs(config, context);

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
        const leftDir = path.join(folderPath.uri.fsPath, `1 - ${sanitize(leftFqdn.label)}%SavedActions`);
        const rightDir = path.join(folderPath.uri.fsPath, `2 - ${sanitize(rightFqdn.label)}%SavedActions`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Saved Action Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `saved action retrieval from ${leftFqdn.label}` });
            await this.processServerSavedActions(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `saved action retrieval from ${rightFqdn.label}` });
            await this.processServerSavedActions(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze saved actions
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Saved Actions',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeSavedActions',
            useLabel: false
        }, context);

        SavedActions.analyzeSavedActions(diffItems, context);
    }

    static processServerSavedActions(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`saved action retrieval - initialized for ${fqdn.label}`);
                    var saved_actions: [any];

                    // get saved actions
                    try {
                        const body = await RestClient.get(`${restBase}/saved_actions`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`saved action retrieval - complete for ${fqdn.label}`);
                        saved_actions = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving saved actions from ${fqdn.label}`, err);
                        return reject(`retrieving saved actions from ${fqdn.label}`);
                    }

                    // remove cache object
                    saved_actions.pop();

                    // iterate through each download export
                    var savedActionCounter: number = 0;
                    var savedActionTotal: number = saved_actions.length;

                    if (savedActionTotal === 0) {
                        OutputChannelLogging.log(`there are 0 saved actions for ${fqdn.label}`);
                        return resolve();
                    } else {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            cancellable: false
                        }, async (innerProgress) => {
                            innerProgress.report({ increment: 0 });

                            const innerIncrement = 100 / saved_actions.length;

                            for (var i = 0; i < saved_actions.length; i++) {
                                const savedAction = saved_actions[i];

                                innerProgress.report({
                                    increment: innerIncrement,
                                    message: `${i + 1}/${saved_actions.length}: ${savedAction.name}`
                                });

                                if (savedAction.hidden_flag) {
                                    if (checkResolve(++savedActionCounter, savedActionTotal, 'saved actions', fqdn)) {
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
                                                saved_actions: {
                                                    include: [
                                                        savedAction.name
                                                    ]
                                                }
                                            },
                                            responseType: 'json',
                                        }, allowSelfSignedCerts, httpTimeout);

                                        const taniumSavedAction: any = body.data.object_list.saved_actions[0];
                                        const savedActionName: string = sanitize(taniumSavedAction.name);

                                        try {
                                            const content: string = JSON.stringify(taniumSavedAction, null, 2);

                                            const savedActionFile = path.join(directory, savedActionName + '.json');
                                            fs.writeFile(savedActionFile, content, (err) => {
                                                if (err) {
                                                    OutputChannelLogging.logError(`could not write ${savedActionFile}`, err);
                                                }
                                            });

                                            if (checkResolve(++savedActionCounter, savedActionTotal, 'saved actions', fqdn)) {
                                                return resolve();
                                            }
                                        } catch (err) {
                                            OutputChannelLogging.logError(`error processing ${label} saved action ${savedActionName}`, err);

                                            if (checkResolve(++savedActionCounter, savedActionTotal, 'saved actions', fqdn)) {
                                                return resolve();
                                            }
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`retrieving saved actionExport for ${savedAction.name} from ${fqdn.label}`, err);

                                        if (checkResolve(++savedActionCounter, savedActionTotal, 'saved actions', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading saved actions from ${restBase}`, err);
                return reject(`error downloading saved actions from ${restBase}`);
            }
        });

        return p;
    }
}