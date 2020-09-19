import * as commands from '../common/commands';
import * as vscode from 'vscode';
import { OutputChannelLogging } from '../common/logging';
import { collectSensorByNameInputs, SensorByNameState } from '../parameter-collection/sensor-by-name-parameters';
import { wrapOption } from '../common/requestOption';
import { collectSensorByHashInputs, SensorByHashState } from '../parameter-collection/sensor-by-hash-parameters';

const got = require('got');

export function activate(context: vscode.ExtensionContext) {
    const myScheme = 'hoganslender';
    const myProvider = new Sensor();

    commands.register(context, {
        'hoganslendertanium.retrieveSensorByName': async () => {
            myProvider.retrieveSensorByName(context);
        },
        'hoganslendertanium.retrieveSensorByHash': async () => {
            myProvider.retrieveSensorByHash(context);
        }
    });

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider));
}

class Sensor implements vscode.TextDocumentContentProvider {
    sensorOutput: string = '';

    onDidChange?: vscode.Event<vscode.Uri> | undefined;

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return this.sensorOutput;
    }

    async retrieveSensorByHash(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state: SensorByHashState = await collectSensorByHashInputs(config, context);

        // collect values
        const fqdn: string = state.fqdn;
        const username: string = state.username;
        const password: string = state.password;
        const sensorHash: string = state.sensorHash;

        const leftRestBase = `https://${fqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${fqdn}`);
        OutputChannelLogging.log(`left username: ${username}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`sensor name: ${sensorHash}`);

        // get session
        var leftSession: string;
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                json: {
                    username: username,
                    password: password,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.post(`${leftRestBase}/session/login`, options);

            leftSession = body.data.session;
        } catch (err) {
            OutputChannelLogging.logError('could not retrieve left session', err);
            return;
        }

        // get sensor
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                headers: {
                    session: leftSession,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.get(`${leftRestBase}/sensors/by-hash/${sensorHash}`, options);

            const sensor = body.data;
            const sensorName = sensor.name;

            try {
                this.sensorOutput = JSON.stringify(sensor, null, 2);

                let uri = vscode.Uri.parse(`hoganslender://by-hash/${sensorName} (${fqdn})`);
                let doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (err) {
                OutputChannelLogging.logError(`error processing sensor`, err);
            }

        } catch (err) {
            OutputChannelLogging.logError(`could not retrieve sensor ${sensorHash}`, err);
        }
    }

    async retrieveSensorByName(context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state: SensorByNameState = await collectSensorByNameInputs(config, context);

        // collect values
        const fqdn: string = state.fqdn;
        const username: string = state.username;
        const password: string = state.password;
        const sensorName: string = state.sensorName;

        const leftRestBase = `https://${fqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${fqdn}`);
        OutputChannelLogging.log(`left username: ${username}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`sensor name: ${sensorName}`);

        // get session
        var leftSession: string;
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                json: {
                    username: username,
                    password: password,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.post(`${leftRestBase}/session/login`, options);

            leftSession = body.data.session;
        } catch (err) {
            OutputChannelLogging.logError('could not retrieve left session', err);
            return;
        }

        // get sensor
        try {
            const options = wrapOption(allowSelfSignedCerts, {
                headers: {
                    session: leftSession,
                },
                responseType: 'json',
                timeout: httpTimeout,
            });

            const { body } = await got.get(`${leftRestBase}/sensors/by-name/${sensorName}`, options);

            const sensor = body.data;

            try {
                this.sensorOutput = JSON.stringify(sensor, null, 2);

                let uri = vscode.Uri.parse(`hoganslender://by-name/${sensorName} (${fqdn})`);
                let doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (err) {
                OutputChannelLogging.logError(`error processing sensor`, err);
            }

        } catch (err) {
            OutputChannelLogging.logError(`could not retrieve sensor ${sensorName}`, err);
        }
    }
}