import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { collectSensorByHashInputs, SensorByHashState } from '../parameter-collection/sensor-by-hash-parameters';
import { collectSensorByNameInputs, SensorByNameState } from '../parameter-collection/sensor-by-name-parameters';

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
        const fqdn: FqdnSetting = state.fqdn;
        const username: string = state.username;
        const password: string = state.password;
        const sensorHash: string = state.sensorHash;

        const leftRestBase = `https://${fqdn.fqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${fqdn.label}`);
        OutputChannelLogging.log(`left username: ${username}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`sensor name: ${sensorHash}`);

        // get session
        var leftSession: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

        // get sensor
        try {
            const body = await RestClient.get(`${leftRestBase}/sensors/by-hash/${sensorHash}`, {
                headers: {
                    session: leftSession,
                },
                responseType: 'json',
            }, allowSelfSignedCerts, httpTimeout);

            const sensor = body.data;
            const sensorName = sensor.name;

            try {
                this.sensorOutput = JSON.stringify(sensor, null, 2);

                let uri = vscode.Uri.parse(`hoganslender://by-hash/${sensorName} (${fqdn.label})`);
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
        const fqdn: FqdnSetting = state.fqdn;
        const username: string = state.username;
        const password: string = state.password;
        const sensorName: string = state.sensorName;

        const leftRestBase = `https://${fqdn.fqdn}/api/v2`;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${fqdn.label}`);
        OutputChannelLogging.log(`left username: ${username}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);
        OutputChannelLogging.log(`sensor name: ${sensorName}`);

        // get session
        var leftSession: string;
        try {
            const body = await RestClient.post(`${leftRestBase}/session/login`, {
                json: {
                    username: username,
                    password: password,
                },
                responseType: 'json',
            }, allowSelfSignedCerts, httpTimeout);

            leftSession = body.data.session;
        } catch (err) {
            OutputChannelLogging.logError('could not retrieve left session', err);
            return;
        }

        // get sensor
        try {
            const body = await RestClient.get(`${leftRestBase}/sensors/by-name/${sensorName}`, {
                headers: {
                    session: leftSession,
                },
                responseType: 'json',
            }, allowSelfSignedCerts, httpTimeout);

            const sensor = body.data;

            try {
                this.sensorOutput = JSON.stringify(sensor, null, 2);

                let uri = vscode.Uri.parse(`hoganslender://by-name/${sensorName} (${fqdn.label})`);
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