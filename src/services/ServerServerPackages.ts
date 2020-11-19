/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import path = require('path');
import { sanitize } from 'sanitize-filename-ts';
import * as fs from 'fs';
import { collectServerServerPackageInputs } from '../parameter-collection/server-server-package-parameters';
import { Session } from '../common/session';
import { RestClient } from '../common/restClient';
import { Packages } from './Packages';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerPackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerPackages.processPackages(context);
        },
    });
}

class ServerServerPackages {
    static async processPackages(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerPackageInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Package Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `package retrieval from ${leftFqdn}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `package retrieval from ${rightFqdn}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze packages
        Packages.analyzePackages(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerPackages(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`package retrieval - initialized for ${fqdn}`);
                    var package_specs: [any];

                    // get packages
                    try {
                        const body = await RestClient.get(`${restBase}/packages`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`package_spec retrieval - complete for ${fqdn}`);
                        package_specs = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving package_specs from ${fqdn}`, err);
                        return reject(`retrieving package_specs from ${fqdn}`);
                    }

                    // iterate through each download export
                    var packageSpecCounter = 0;
                    var packageSpecTotal = package_specs.length - 1;
                    for (var i = 0; i < package_specs.length - 1; i++) {
                        const packageSpec: any = package_specs[i];

                        if (i % 30 === 0 || i === packageSpecTotal) {
                            OutputChannelLogging.log(`processing ${i + 1} of ${packageSpecTotal}`);
                        }

                        if (packageSpec?.content_set?.name === 'Reserved') {
                            packageSpecCounter++;

                            if (packageSpecTotal === packageSpecCounter) {
                                OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                resolve();
                            }
                        }

                        // get export
                        try {
                            const body = await RestClient.post(`${restBase}/export`, {
                                headers: {
                                    session: session,
                                },
                                json: {
                                    package_specs: {
                                        include: [
                                            packageSpec.name
                                        ]
                                    }
                                },
                                responseType: 'json',
                            }, allowSelfSignedCerts, httpTimeout);

                            const taniumPackage: any = body.data.object_list.package_specs[0];
                            const packageName: string = sanitize(taniumPackage.name);

                            try {
                                const content: string = JSON.stringify(body.data.object_list, null, 2);

                                const packageFile = path.join(directory, packageName + '.json');
                                fs.writeFile(packageFile, content, (err) => {
                                    if (err) {
                                        OutputChannelLogging.logError(`could not write ${packageFile}`, err);
                                    }

                                    packageSpecCounter++;

                                    if (packageSpecTotal === packageSpecCounter) {
                                        OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                        resolve();
                                    }
                                });
                            } catch (err) {
                                OutputChannelLogging.logError(`error processing ${label} package ${packageName}`, err);
                                packageSpecCounter++;

                                if (packageSpecTotal === packageSpecCounter) {
                                    OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                    resolve();
                                }
                            }
                        } catch (err) {
                            OutputChannelLogging.logError(`retrieving packageExport for ${packageSpec.name} from ${fqdn}`, err);
                            packageSpecCounter++;

                            if (packageSpecTotal === packageSpecCounter) {
                                OutputChannelLogging.log(`processed ${packageSpecTotal} packages from ${fqdn}`);
                                resolve();
                            }
                        }
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading packages from ${restBase}`, err);
                return reject(`error downloading packages from ${restBase}`);
            }
        });

        return p;
    }
}