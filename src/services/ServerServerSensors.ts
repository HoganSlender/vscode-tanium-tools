/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { sanitize } from 'sanitize-filename-ts';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';

import path = require('path');
import { collectServerServerSensorInputs } from '../parameter-collection/server-server-sensors-parameters';
import { Sensors } from './Sensors';
import { checkResolve } from '../common/checkResolve';
import { ServerServerBase } from './ServerServerBase';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { PathUtils } from '../common/pathUtils';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSensors': () => {
            ServerServerSensors.processSensors(context);
        },
    });
}

export class ServerServerSensors extends ServerServerBase {
    static async processSensors(context: vscode.ExtensionContext) {
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

        const state = await collectServerServerSensorInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn.label)}%Sensors`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn.label)}%Sensors`);

        if (!fs.existsSync(leftDir)) {
            fs.mkdirSync(leftDir);
        }

        if (!fs.existsSync(rightDir)) {
            fs.mkdirSync(rightDir);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Sensor Compare',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const increment = 50;

            progress.report({ increment: increment, message: `sensor retrieval from ${leftFqdn.label}` });
            await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn.label}` });
            await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise<void>(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze sensors
        const diffItems = await PathUtils.getDiffItems(leftDir, rightDir, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Sensors',
            leftDir: leftDir,
            rightDir: rightDir,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzeSensors',
        }, context);

        Sensors.analyzeSensors(diffItems, context);
    }

    static processServerSensors(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn.fqdn}/api/v2`;

        const p = new Promise<void>(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                OutputChannelLogging.log(`sensor retrieval - initialized for ${fqdn.label}`);
                var sensors: [any];

                // get sensors
                try {
                    const body = await RestClient.get(`${restBase}/sensors`, {
                        headers: {
                            session: session,
                        },
                        responseType: 'json',
                    }, allowSelfSignedCerts, httpTimeout);

                    OutputChannelLogging.log(`sensor retrieval - complete for ${fqdn.label}`);
                    sensors = body.data;
                } catch (err) {
                    OutputChannelLogging.logError(`retrieving sensors from ${fqdn.label}`, err);
                    return reject(`retrieving content_set_roles from ${fqdn.label}`);
                }

                // remove cache object
                sensors.pop();

                // iterate through each download export
                var sensorCounter: number = 0;
                var sensorTotal: number = sensors.length;

                if (sensorTotal === 0) {
                    OutputChannelLogging.log(`there are 0 sensors for ${fqdn.label}`);
                    resolve();
                } else {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        cancellable: false
                    }, async (innerProgress) => {
                        innerProgress.report({
                            increment: 0
                        });

                        const innerIncrement = 100 / sensors.length;

                        for (var i = 0; i < sensors.length; i++) {
                            const sensor = sensors[i];

                            innerProgress.report({
                                increment: innerIncrement,
                                message: `${i + 1}/${sensors.length}: ${sensor.name}`
                            });

                            // get export
                            try {
                                const body = await RestClient.post(`${restBase}/export`, {
                                    headers: {
                                        session: session,
                                    },
                                    json: {
                                        sensors: {
                                            include: [
                                                sensor.name
                                            ]
                                        }
                                    },
                                    responseType: 'json',
                                }, allowSelfSignedCerts, httpTimeout);

                                const taniumSensor: any = body.data.object_list.sensors[0];
                                const sensorName: string = sanitize(taniumSensor.name);

                                try {
                                    const transformed = this.transformSensor(taniumSensor);
                                    const content: string = JSON.stringify(transformed, null, 2);

                                    const sensorFile = path.join(directory, sensorName + '.json');
                                    fs.writeFile(sensorFile, content, (err) => {
                                        if (err) {
                                            OutputChannelLogging.logError(`could not write ${sensorFile}`, err);
                                        }

                                        if (checkResolve(++sensorCounter, sensorTotal, 'sensors', fqdn)) {
                                            return resolve();
                                        }
                                    });
                                } catch (err) {
                                    OutputChannelLogging.logError(`error processing ${label} sensors ${sensorName}`, err);

                                    if (checkResolve(++sensorCounter, sensorTotal, 'sensors', fqdn)) {
                                        return resolve();
                                    }
                                }
                            } catch (err) {
                                OutputChannelLogging.logError(`saving sensor file for ${sensor.name} from ${fqdn.label}`, err);

                                if (checkResolve(++sensorCounter, sensorTotal, 'sensors', fqdn)) {
                                    return resolve();
                                }
                            }
                        }
                    });
                }
            } catch (err) {
                OutputChannelLogging.logError(`error downloading sensors from ${restBase}`, err);
                return reject(`error downloading sensors from ${restBase}`);
            }
        });

        return p;
    }

    static transformSensor(sensor: any) {
        sensor['description'] = this.convertWhitespace(sensor.description);

        sensor.queries.forEach((query: any) => {
            query['script'] = this.convertWhitespace(query.script);
        });

        return sensor;
    }

    private static convertWhitespace(input: string) {
        var converted = input.replace(/\r/g, '').split(/\n/);
        if (converted[converted.length - 1] === '') {
            converted.pop();
        }

        return converted;
    }
}
