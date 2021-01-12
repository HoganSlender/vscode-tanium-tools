/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectServerServerPackageInputs } from '../parameter-collection/server-server-package-parameters';
import { Packages } from './Packages';

import path = require('path');
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerPackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerPackages.processPackages(context);
        },
    });
}

class ServerServerPackages extends ServerServerBase {
    static async processPackages(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerPackageInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%Packages`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%Packages`);

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

            progress.report({ increment: increment, message: `package retrieval from ${leftFqdn.label}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `package retrieval from ${rightFqdn.label}` });
            await this.processServerPackages(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze packages
        Packages.analyzePackages(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerPackages(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`package retrieval - initialized for ${fqdn.label}`);
                    var package_specs: [any];

                    // get packages
                    try {
                        const body = await RestClient.get(`${restBase}/packages`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`package_spec retrieval - complete for ${fqdn.label}`);
                        package_specs = body.data;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving package_specs from ${fqdn.label}`, err);
                        return reject(`retrieving package_specs from ${fqdn.label}`);
                    }

                    // remove cache object
                    package_specs.pop();

                    // iterate through each download export
                    var packageSpecCounter: number = 0;
                    var packageSpecTotal: number = package_specs.length;

                    if (packageSpecTotal === 0) {
                        OutputChannelLogging.log(`there are 0 packages for ${fqdn.label}`);
                        return resolve();
                    } else {
                        for (var i = 0; i < package_specs.length; i++) {
                            const packageSpec = package_specs[i];

                            if (i % 30 === 0 || i === packageSpecTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${packageSpecTotal}`);
                            }

                            if (packageSpec.deleted_flag) {
                                if (checkResolve(++packageSpecCounter, packageSpecTotal, 'packages', fqdn)) {
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
                                        const content: string = JSON.stringify(taniumPackage, null, 2);

                                        const packageFile = path.join(directory, packageName + '.json');
                                        fs.writeFile(packageFile, content, (err) => {
                                            if (err) {
                                                OutputChannelLogging.logError(`could not write ${packageFile}`, err);
                                            }
                                        });

                                        if (checkResolve(++packageSpecCounter, packageSpecTotal, 'packages', fqdn)) {
                                            return resolve();
                                        }
                                    } catch (err) {
                                        OutputChannelLogging.logError(`error processing ${label} package ${packageName}`, err);

                                        if (checkResolve(++packageSpecCounter, packageSpecTotal, 'packages', fqdn)) {
                                            return resolve();
                                        }
                                    }
                                } catch (err) {
                                    OutputChannelLogging.logError(`retrieving packageExport for ${packageSpec.name} from ${fqdn.label}`, err);

                                    if (checkResolve(++packageSpecCounter, packageSpecTotal, 'packages', fqdn)) {
                                        return resolve();
                                    }
                                }
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