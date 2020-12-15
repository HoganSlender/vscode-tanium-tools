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
import { collectServerServerSavedQuestionInputs } from '../parameter-collection/server-server-saved-questions-parameters';
import { SavedQuestions } from './SavedQuestions';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSavedQuestions': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerSavedQuestions.processSavedQuestions(context);
        },
    });
}

export class ServerServerSavedQuestions {
    static async processSavedQuestions(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.workspaceFolders![0];

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerSavedQuestionInputs(config, context);

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
        const leftDir = path.join(folderPath.uri.fsPath, `1 - ${sanitize(leftFqdn)}%SavedQuestions`);
        const rightDir = path.join(folderPath.uri.fsPath, `2 - ${sanitize(rightFqdn)}%SavedQuestions`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Saved Question Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `saved question retrieval from ${leftFqdn}` });
            await this.processServerSavedQuestions(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `saved question retrieval from ${rightFqdn}` });
            await this.processServerSavedQuestions(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze saved questions
        SavedQuestions.analyzeSavedQuestions(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerSavedQuestions(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`saved question retrieval - initialized for ${fqdn}`);
                    var saved_question: [any];

                    // get saved questions
                    try {
                        const body = await RestClient.get(`${restBase}/saved_questions`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`saved question retrieval - complete for ${fqdn}`);
                        saved_question = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving saved questions from ${fqdn}`, err);
                        return reject(`retrieving saved questions from ${fqdn}`);
                    }

                    // remove cache object
                    saved_question.pop();

                    // iterate through each download export
                    var savedQuestionCounter: number = 0;
                    var savedQuestionTotal: number = saved_question.length;

                    if (savedQuestionTotal === 0) {
                        OutputChannelLogging.log(`there are 0 saved questions for ${fqdn}`);
                        return resolve();
                    } else {
                        var i = 0;

                        saved_question.forEach(async savedQuestion => {
                            i++;

                            if (i % 30 === 0 || i === savedQuestionTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${savedQuestionTotal}`);
                            }

                            if (savedQuestion.hidden_flag) {
                                if (checkResolve(++savedQuestionCounter, savedQuestionTotal, 'saved questions', fqdn)) {
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
                                            saved_questions: {
                                                include: [
                                                    savedQuestion.name
                                                ]
                                            }
                                        },
                                        responseType: 'json',
                                    }, allowSelfSignedCerts, httpTimeout);

                                    const taniumSavedQuestion: any = body.data.object_list.saved_questions[0];
                                    const savedQuestionName: string = sanitize(taniumSavedQuestion.name);

                                    try {
                                        const content: string = JSON.stringify(taniumSavedQuestion, null, 2);

                                        const savedQuestionFile = path.join(directory, savedQuestionName + '.json');
                                        fs.writeFile(savedQuestionFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${savedQuestionFile}`, err);
                                            }
                                        });

                                        if (checkResolve(++savedQuestionCounter, savedQuestionTotal, 'saved questions', fqdn)) {
                                            return resolve();
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} saved question ${savedQuestionName}`, err);

                                        if (checkResolve(++savedQuestionCounter, savedQuestionTotal, 'saved questions', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`retrieving saved questionExport for ${savedQuestion.name} from ${fqdn}`, err);

                                    if (checkResolve(++savedQuestionCounter, savedQuestionTotal, 'saved questions', fqdn)) {
                                        return resolve();
                                    }
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading saved questions from ${restBase}`, err);
                return reject(`error downloading saved questions from ${restBase}`);
            }
        });

        return p;
    }
}