/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OpenType } from '../common/enums';
import { OutputChannelLogging } from '../common/logging';
import { PathUtils } from '../common/pathUtils';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { SigningUtils } from '../common/signingUtils';
import { WebContentUtils } from '../common/webContentUtils';
import { SigningKey } from '../types/signingKey';

import path = require('path');
import { DiffBase } from './DiffBase';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzePackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Packages.analyzePackages(uris[0], uris[1], context);
        },
    });
}

export class Packages extends DiffBase {
    static async analyzePackages(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const diffItems = await PathUtils.getDiffItems(left.fsPath, right.fsPath, true);

        TaniumDiffProvider.currentProvider?.addDiffData({
            label: 'Packages',
            leftDir: left.fsPath,
            rightDir: right.fsPath,
            diffItems: diffItems,
            commandString: 'hoganslendertanium.analyzePackages',
        }, context);

        const panels = this.createPanels('Packages', diffItems);

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        OutputChannelLogging.log(`missing packages: ${diffItems.missing.length}`);
        OutputChannelLogging.log(`modified packages: ${diffItems.modified.length}`);
        OutputChannelLogging.log(`created packages: ${diffItems.created.length}`);
        OutputChannelLogging.log(`unchanged packages: ${diffItems.unchanged.length}`);

        const title = 'Packages';

        panels.missing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: diffItems.missing,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            openType: OpenType.file,
        }, panels.missing, context, config);

        panels.modified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: diffItems.modified,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            openType: OpenType.diff,
        }, panels.modified, context, config);

        panels.created.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: diffItems.created,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            showSourceCreds: true,
            showDestServer: true,
            openType: OpenType.file,
        }, panels.created, context, config);

        panels.unchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: diffItems.unchanged,
            transferIndividual: 0,
            showServerInfo: 0,
            showDestServer: false,
            openType: OpenType.diff,
        }, panels.unchanged, context, config);

        panels.unchanged.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case "openDiff":
                        var items = message.path.split('~');
                        var lPath = items[0];
                        var rPath = items[2];
                        var title = `${message.name}.json (${PathUtils.getPath(lPath)} ↔ ${PathUtils.getPath(rPath)})`;
                        vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(lPath), vscode.Uri.file(rPath), title, {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.modified.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItem':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferPackage(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                        );

                        // send message back
                        panels.modified.webview.postMessage({
                            command: 'complete',
                        });
                        break;

                    case "openDiff":
                        var diffItems = message.path.split('~');
                        var lPath = diffItems[0];
                        var rPath = diffItems[2];
                        var title = `${message.name}.json (${PathUtils.getPath(lPath)} ↔ ${PathUtils.getPath(rPath)})`;
                        vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(lPath), vscode.Uri.file(rPath), title, {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.missing.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'completeProcess':
                        vscode.window.showInformationMessage("Selected packages have been migrated");
                        break;

                    case 'transferItem':
                        // get signing keys
                        const signingKeys: SigningKey[] = config.get<any>('signingPaths', []);

                        const signingKey = signingKeys.find(signingKey => signingKey.serverLabel === message.signingServerLabel);

                        const items = message.path.split('~');
                        var path = items[0];
                        var targetPath = items[2];

                        await this.transferPackage(
                            allowSelfSignedCerts,
                            httpTimeout,
                            message.sourceFqdn,
                            message.sourceUsername,
                            message.sourcePassword,
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                        );

                        // send message back
                        panels.missing.webview.postMessage({
                            command: 'complete',
                        });
                        break;

                    case "openFile":
                        var lPath = message.path.split('~')[0];
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(lPath), {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });

        panels.created.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case "openFile":
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.path), {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                        break;
                }
            } catch (err) {
                OutputChannelLogging.logError('error processing message', err);
            }
        });
    }

    static async transferPackage(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        sourceFqdn: string,
        sourceUsername: string,
        sourcePassword: string,
        destFqdn: string,
        destUsername: string,
        destPassword: string,
        filePath: string,
        targetFilePath: string,
        signingKey: SigningKey,
        packageName: string
    ) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get package data from file
                const packageSpecFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                // get package name
                const packageName = packageSpecFromFile.name;

                // generate export json
                var exportJson = {
                    package_specs: {
                        include: [
                            packageName
                        ]
                    }
                };

                const sourceSession = await Session.getSession(allowSelfSignedCerts, httpTimeout, sourceFqdn, sourceUsername, sourcePassword);

                const body = await RestClient.post(`https://${sourceFqdn}/api/v2/export`, {
                    headers: {
                        session: sourceSession,
                    },
                    json: exportJson,
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                // generate import json
                const importJson = body.data;

                // get signed content
                const signedContentData = await SigningUtils.retrieveSignedContent(importJson, signingKey);
                const signedContent = signedContentData.content;
                const tempPath = signedContentData.path;

                try {
                    // get session
                    const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, destUsername, destPassword);

                    // check for existing package; if exists then delete it
                    const restBase = `https://${destFqdn}/api/v2`;
                    try {
                        const body = await RestClient.get(`${restBase}/packages/by-name/${packageSpecFromFile.package_specs[0].name}`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);

                        const foundId = body.data.id;

                        // delete package
                        const deleteBody = await RestClient.delete(`${restBase}/packages/${foundId}`, {
                            headers: {
                                session: session,
                            },
                            responseType: 'json',
                        }, allowSelfSignedCerts, httpTimeout);
                        console.log(JSON.stringify(deleteBody));

                    } catch (err) {
                        // ignore, package doesn't exist
                        console.log(err);
                    }

                    // import package
                    OutputChannelLogging.log(`importing ${packageName} into ${destFqdn}`);

                    const res = SigningUtils.postSignedContent(destFqdn, session, signedContent, allowSelfSignedCerts, httpTimeout);

                    OutputChannelLogging.log(`importing ${packageName} complete`);

                    // process package files
                    const packageSpec = packageSpecFromFile.package_specs[0];

                    for(var i = 0; i < packageSpec.files.length; i++) {
                        const packageFile = packageSpec.files[i];
                        if (packageFile.source.length === 0) {
                            OutputChannelLogging.log(`processing ${packageFile.name}`);

                            // download file to temp dir
                            const tempDir = os.tmpdir();
                            const tempFilePath = path.join(tempDir, packageFile.hash);
                            await RestClient.downloadFile(`https://${sourceFqdn}/cache/${packageFile.hash}`, tempFilePath, {}, allowSelfSignedCerts, httpTimeout);
                            OutputChannelLogging.log(`downloaded ${packageFile.name} to ${tempFilePath}`);

                            // upload file to tanium server
                            OutputChannelLogging.log(`uploading ${packageFile.name} to ${destFqdn}`);
                            await this.uploadFile(destFqdn, allowSelfSignedCerts, httpTimeout, destUsername, destPassword, tempFilePath, packageFile.name);
                            OutputChannelLogging.log(`uploading ${packageFile.name} complete.`);

                            // delete temp file
                            fs.unlinkSync(tempFilePath);
                        }
                    }

                    OutputChannelLogging.log(`all files processed for ${packageSpec.name}`);

                    // delete package temp file
                    fs.unlinkSync(tempPath);

                    // create the missing file
                    const targetContents = fs.readFileSync(filePath, 'utf-8');
                    fs.writeFileSync(targetFilePath, targetContents);
                } catch (err) {
                    OutputChannelLogging.logError('error retrieving session', err);
                    reject();
                }

                resolve();
            } catch (err) {
                OutputChannelLogging.logError('error transferring packages', err);
                reject();
            }
        });

        return p;
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
        const p = new Promise<any>(async (resolve, reject) => {
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
        const p = new Promise<any>(async (resolve, reject) => {
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
}