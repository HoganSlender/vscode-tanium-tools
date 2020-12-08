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

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.compareServerServerSensors': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ServerServerSensors.processSensors(context);
        },
    });
}

export class ServerServerSensors {
    static async processSensors(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectServerServerSensorInputs(config, context);

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
        const leftDir = path.join(folderPath!, `1 - ${sanitize(leftFqdn)}%Sensors`);
        const rightDir = path.join(folderPath!, `2 - ${sanitize(rightFqdn)}%Sensors`);

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

            progress.report({ increment: increment, message: `sensor retrieval from ${leftFqdn}` });
            await this.processServerSensors(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword, leftDir, 'left');
            progress.report({ increment: increment, message: `sensor retrieval from ${rightFqdn}` });
            await this.processServerSensors(allowSelfSignedCerts, httpTimeout, rightFqdn, rightUsername, rightPassword, rightDir, 'right');
            const p = new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 3000);
            });

            return p;
        });

        // analyze sensors
        Sensors.analyzeSensors(vscode.Uri.file(leftDir), vscode.Uri.file(rightDir), context);
    }

    static processServerSensors(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: string, username: string, password: string, directory: string, label: string) {
        const restBase = `https://${fqdn}/api/v2`;

        const p = new Promise(async (resolve, reject) => {
            try {
                // get session
                var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

                (async () => {
                    OutputChannelLogging.log(`sensor retrieval - initialized for ${fqdn}`);
                    var sensors: [any];

                    // get packages
                    try {
                        const body = await RestClient.post(`${restBase}/export`, {
                            headers: {
                                session: session,
                            },
                            json: {
                                "sensors": {
                                    "include_all": true,
                                }
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        OutputChannelLogging.log(`sensor retrieval - complete for ${fqdn}`);
                        sensors = body.data.object_list.sensors;
                    } catch (err) {
                        OutputChannelLogging.logError(`retrieving sensors from ${fqdn}`, err);
                        return reject(`retrieving content_set_roles from ${fqdn}`);
                    }

                    // iterate through each download export
                    var sensorCounter: number = 0;
                    var sensorTotal: number = sensors.length;

                    if (sensorTotal === 0) {
                        OutputChannelLogging.log(`there are 0 sensors for ${fqdn}`);
                        resolve();
                    } else {
                        var i = 0;

                        sensors.forEach(sensor => {
                            i++;

                            if (i % 30 === 0 || i === sensorTotal) {
                                OutputChannelLogging.log(`processing ${i} of ${sensorTotal}`);
                            }

                            // get export
                            try {
                                const sensorName: string = sanitize(sensor.name);

                                try {
                                    const transformed = this.transformSensor(sensor);
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
                                OutputChannelLogging.logError(`saving sensor file for ${sensor.name} from ${fqdn}`, err);

                                if (checkResolve(++sensorCounter, sensorTotal, 'sensors', fqdn)) {
                                    return resolve();
                                }
                            }
                        });
                    }
                })();
            } catch (err) {
                OutputChannelLogging.logError(`error downloading sensors from ${restBase}`, err);
                return reject(`error downloading sensors from ${restBase}`);
            }
        });

        return p;
    }

    static transformSensors(sensors: any[]) {
        if (sensors === undefined) {
            return sensors;
        }

        sensors.forEach((sensor) => {
            sensor = this.transformSensor(sensor);
        });

        return sensors;
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
