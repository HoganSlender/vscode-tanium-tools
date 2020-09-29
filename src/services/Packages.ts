/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import path = require('path');
import { SignContentFile } from './SignContentFile';
import { OutputChannelLogging } from '../common/logging';
import { SigningKey } from '../types/signingKey';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.generateMissingPackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Packages.missingPackages(uris[0], uris[1], context);
        },
    });
}

class Packages {
    static async missingPackages(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel(
            'hoganslenderMissingPackages',
            'Missing Packages',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        // define output channel
        OutputChannelLogging.initialize();
        OutputChannelLogging.showClear();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const missingPackages = await this.getMissingPackages(left.fsPath, right.fsPath);

        panel.webview.html = this.getWebContent(missingPackages, panel, context, config);

        panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferPackage':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        await this.transferPackage(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.destFqdn,
                            message.username,
                            message.password,
                            message.path,
                            signingKey!,
                            message.packageName,
                            panel,
                        );

                        // send message back
                        panel.webview.postMessage({
                            command: 'completePackage',
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });
    }

    static async transferPackage(allowSelfSignedCerts: boolean, httpTimeout: number, sourceFqdn: string, destFqdn: string, username: string, password: string, filePath: string, signingKey: SigningKey, packageName: string, panel: vscode.WebviewPanel) {
        OutputChannelLogging.initialize();

        // get package data from file
        const packageSpecFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // generate import json
        const importJson = {
            object_list: {
                package_specs: [
                    packageSpecFromFile
                ]
            },
            version: 2
        };

        // save file in temp
        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, uuidv4());
        fs.writeFileSync(tempPath, `${JSON.stringify(importJson)}\r\n`, 'utf-8');
        OutputChannelLogging.log(`wrote package data to ${tempPath}`);

        // sign json
        await SignContentFile.signContent(signingKey.keyUtilityPath, signingKey.privateKeyFilePath, tempPath);
        OutputChannelLogging.log(`signed package data at ${tempPath}`);

        // import into Tanium server
        const signedContent = fs.readFileSync(tempPath, {
            encoding: 'utf-8'
        });

        try {
            // get session
            const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

            // import package
            OutputChannelLogging.log(`importing ${packageName} into ${destFqdn}`);

            const options = {
                hostname: destFqdn,
                port: 443,
                path: '/api/v2/import',
                method: 'POST',
                headers: {
                    session: session,
                    'Content-Type': 'text/plain',
                    'Content-Length': signedContent.length
                },
                rejectUnauthorized: !allowSelfSignedCerts,
                timeout: httpTimeout
            };

            const data = await RestClient.postTextPlain(signedContent, options);
            const dataAsString = data.toString();

            OutputChannelLogging.log(`importing ${packageName} complete`);

            // process package files
            const packageSpec = packageSpecFromFile;

            for (var i = 0; i < packageSpec.files.length; i++) {
                var packageFile = packageSpec.files[i];

                if (packageFile.source.length === 0) {
                    OutputChannelLogging.log(`processing ${packageFile.name}`);

                    // download file to temp dir
                    const tempFilePath = path.join(tempDir, packageFile.hash);
                    await RestClient.downloadFile(`https://${sourceFqdn}/cache/${packageFile.hash}`, tempFilePath, {}, allowSelfSignedCerts, httpTimeout);
                    OutputChannelLogging.log(`downloaded ${packageFile.name} to ${tempFilePath}`);

                    // upload file to tanium server
                    OutputChannelLogging.log(`uploading ${packageFile.name} to ${destFqdn}`);
                    await this.uploadFile(destFqdn, allowSelfSignedCerts, httpTimeout, username, password, tempFilePath, packageFile.name);
                    OutputChannelLogging.log(`uploading ${packageFile.name} complete.`);

                    // delete temp file
                    fs.unlinkSync(tempFilePath);
                }
            }
            OutputChannelLogging.log(`all files processed for ${packageSpec.name}`);

            // delete package temp file
            fs.unlinkSync(tempPath);
        } catch (err) {
            OutputChannelLogging.logError('error retrieving session', err);
        }
    }

    static async uploadFile(destFqdn: string, allowSelfSignedCerts: boolean, httpTimeout: number, username: string, password: string, tempFilePath: string, packageFileName: string) {
        const constPartSize = 524288;

        // get bytes of file to upload
        const bytes = fs.readFileSync(tempFilePath);

        if (bytes.length > constPartSize) {
            // break down into bits
            const fileSize = bytes.length;
            var startPos = 0;
            var partSize = constPartSize;
            var remainder = fileSize;
            var uploadId = -1;

            while (remainder > 0) {
                if (remainder < partSize) {
                    partSize = remainder;
                }

                remainder = remainder - partSize;

                var bits = bytes.slice(startPos, startPos + partSize);
                var base64 = bits.toString('base64');

                // add to server
                const res = await this.uploadFileBits(destFqdn, allowSelfSignedCerts, httpTimeout, username, password, uploadId, base64, fileSize, startPos, partSize);
                OutputChannelLogging.log(`${packageFileName}: ${res.data.upload_file.percent_complete}%`);

                uploadId = res.data.upload_file.id;

                startPos = startPos + partSize;
            }
        } else {
            const res = await this.uploadFileTotal(destFqdn, allowSelfSignedCerts, httpTimeout, username, password, bytes);
            OutputChannelLogging.log(`${packageFileName}: ${res.data.upload_file.percent_complete}%`);
        }
    }

    static uploadFileTotal(destFqdn: string, allowSelfSignedCerts: boolean, httpTimeout: number, username: string, password: string, bytes: Buffer): Promise<any> {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            // get session
            const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

            var uploadFileJson = {
                file_size: bytes.length,
                bytes: bytes.toString('base64'),
            };

            try {
                const options = {
                    headers: {
                        session: session,
                    },
                    json: uploadFileJson,
                    responseType: 'json',
                };

                const body = await RestClient.post(`https://${destFqdn}/api/v2/upload_file`, options, allowSelfSignedCerts, httpTimeout);
                return resolve(body);
            } catch (err) {
                OutputChannelLogging.logError(`error transferring file bits`, err);
                return reject();
            }
        });

        return p;
    }

    static uploadFileBits(destFqdn: string, allowSelfSignedCerts: boolean, httpTimeout: number, username: string, password: string, uploadId: number, base64: string, fileSize: number, startPos: number, partSize: number): Promise<any> {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            // get session
            const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

            var uploadFileJson: any;

            if (uploadId === -1) {
                uploadFileJson = {
                    file_size: fileSize,
                    start_pos: startPos,
                    bytes: base64,
                    part_size: partSize
                };
            } else {
                uploadFileJson = {
                    id: uploadId,
                    file_size: fileSize,
                    start_pos: startPos,
                    bytes: base64,
                    part_size: partSize
                };
            }

            try {
                const options = {
                    headers: {
                        session: session,
                    },
                    json: uploadFileJson,
                    responseType: 'json',
                };

                const body = await RestClient.post(`https://${destFqdn}/api/v2/upload_file`, options, allowSelfSignedCerts, httpTimeout);
                return resolve(body);
            } catch (err) {
                OutputChannelLogging.logError(`error transferring file bits`, err);
                return reject();
            }
        });

        return p;
    }

    static getMissingPackages(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var missing: any[] = [];

            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                const leftTarget = path.join(leftDir, file);
                const rightTarget = leftTarget.replace(leftDir, rightDir);

                if (!fs.existsSync(rightTarget)) {
                    missing.push({
                        name: file.replace('.json', ''),
                        path: leftTarget
                    });
                }

                if (i === file.length - 1) {
                    resolve(missing);
                }
            }
        });

        return p;
    }

    static getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    static getWebContent(missingPackages: any[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdns: string[] = config.get('fqdns', []);

        // get usernames
        const usernames: string[] = config.get('usernames', []);

        // get signing keys
        const signingKeys = config.get<any>('signingPaths', []);

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js');

        // And the uri we use to load this script in the webview
        const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        let html: string = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Missing Packages</title>
    <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${panel.webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';"
  />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<table style="border: 1px solid black;">
        <tr>
            <td><b>Missing Packages</b></td>
            <td></td>
            <td><b>Selected Packages</b></td>
        </tr>
        <tr>
            <td>
                <select id="mpackages" name="mpackages" multiple="multiple" size="40" style="min-width: 600px;min-height: 800px;">`;
        for (var i = 0; i < missingPackages.length; i++) {
            html = html + `<option value="${missingPackages[i].path}">${missingPackages[i].name}</option>`;
        }


        html = html + `</select></td>
        <td><button type="button" id="addButton">></button><br/><br/><button type="button" id="removeButton"><</button></td>
        <td><select id="spackages" name="spackages" multiple="multiple" size="40" style="min-width: 600px;min-height: 800px;"/></td>
        </tr>
        <tr>
            <td colspan="3" align="right">
                <table>
                    <tr>
                        <td>Source Tanium Server FQDN</td>
                        <td><div id="divSourceFqdn"/></td>
                    </tr>
                    <tr>
                        <td>Destination Tanium Server FQDN</td>
                        <td><div id="divDestFqdn"/></td>
                    </tr>
                    <tr>
                        <td>Destination Tanium Server Username</td>
                        <td><div id="divUsername"/></td>
                    </tr>
                    <tr>
                        <td>Destination Tanium Server Password</td>
                        <td><input id="taniumServerPassword" type="password"/></td>
                    </tr>
                    <tr>
                        <td>Destination Tanium Server Signing Keys</td>
                        <td><div id="divSigningKey" /></td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td colspan="3" align="right"><button id="processButton">Process Packages</button></td>
        </tr>
        </table>`;

        html = html + `<div id="divFqdns" style="visibility: hidden;">`;

        // add fqdns
        for (var i = 0; i < fqdns.length; i++) {
            const fqdn = fqdns[i];
            if (i === fqdns.length - 1) {
                html = html + fqdn;
            } else {
                html = html + `${fqdn},`;
            }
        }

        html = html + `</div>`;

        html = html + `<div id="divUsernames" style="visibility: hidden;">`;

        // add usernames
        for (var i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            if (i === usernames.length - 1) {
                html = html + username;
            } else {
                html = html + `${username},`;
            }
        }

        html = html + `</div>`;

        html = html + `<div id="divSigningKeys" style="visibility: hidden;">`;

        // add signing keys
        for (var i = 0; i < signingKeys.length; i++) {
            const signingKey = signingKeys[i];
            if (i === signingKeys.length - 1) {
                html = html + signingKey.serverLabel;
            } else {
                html = html + `${signingKey.serverLabel},`;
            }
        }

        html = html + `</div>`;

        html = html + `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
</html>`;

        return html;
    }
}