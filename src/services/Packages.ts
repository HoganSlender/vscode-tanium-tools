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
import { collectPackageFilesInputs } from '../parameter-collection/package-download-files-parameters';
import { SigningKey } from '../types/signingKey';

import path = require('path');

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzePackages': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            Packages.analyzePackages(uris[0], uris[1], context);
        },
        'hoganslendertanium.downloadPackageFiles': () => {
            Packages.downloadPackageFiles(context);
        }
    });
}

export class Packages {
    static async downloadPackageFiles(context: vscode.ExtensionContext) {
        // get the current folder
        const folderPath = vscode.workspace.rootPath;

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        const state = await collectPackageFilesInputs(config, context);

        // collect values
        const leftFqdn: string = state.leftFqdn;
        const leftUsername: string = state.leftUsername;
        const leftPassword: string = state.leftPassword;
        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`left fqdn: ${leftFqdn}`);
        OutputChannelLogging.log(`left username: ${leftUsername}`);
        OutputChannelLogging.log(`left password: XXXXXXXX`);

        const restBase = `https://${leftFqdn}/api/v2`;

        // get session
        var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, leftFqdn, leftUsername, leftPassword);

        OutputChannelLogging.log(`package retrieval - initialized for ${leftFqdn}`);

        try {
            const body = await RestClient.get(`${restBase}/packages`, {
                headers: {
                    session: session,
                },
                responseType: 'json'
            }, allowSelfSignedCerts, httpTimeout);
            OutputChannelLogging.log(`package retrieval - complete for ${leftFqdn}`);

            const packageSpecs: any[] = body.data;

            for (var i = 0; i < packageSpecs.length; i++) {
                const packageSpec = packageSpecs[i];

                OutputChannelLogging.log(`processing ${i + 1} of ${packageSpecs.length}: ${packageSpec.name} files`);

                // iterate through files
                for (var j = 0; j < packageSpec?.files?.length; j++) {
                    const packageFile = packageSpec.files[j];

                    if (packageFile.source.length === 0) {
                        OutputChannelLogging.log(`\tprocessing ${j + 1} of ${packageSpec.files.length}: ${packageFile.name}`);
                        // download the file
                        await RestClient.downloadFile(`https://${leftFqdn}/cache/${packageFile.hash}`, path.join(folderPath!, packageFile.name), {}, allowSelfSignedCerts, httpTimeout);
                        OutputChannelLogging.log(`\tdownloaded ${packageFile.name}`);
                    }
                }
            }
        } catch (err) {
            OutputChannelLogging.logError(`processing packages from ${leftFqdn}`, err);
        }
    }

    static async analyzePackages(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingPackages',
            'Missing Packages',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedPackages',
            'Modified Packages',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedPackages',
            'Created Packages',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedPackages',
            'Unchanged Packages',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const missingPackages = await PathUtils.getMissingItems(left.fsPath, right.fsPath);
        const modifiedPackages = await PathUtils.getModifiedItems(left.fsPath, right.fsPath);
        const createdPackages = await PathUtils.getCreatedItems(left.fsPath, right.fsPath);
        const unchangedPackages = await PathUtils.getUnchangedItems(left.fsPath, right.fsPath);

        OutputChannelLogging.log(`missing packages: ${missingPackages.length}`);
        OutputChannelLogging.log(`modified packages: ${modifiedPackages.length}`);
        OutputChannelLogging.log(`created packages: ${createdPackages.length}`);
        OutputChannelLogging.log(`unchanged packages: ${unchangedPackages.length}`);

        const title = 'Packages';

        panelMissing.webview.html = WebContentUtils.getMissingWebContent({
            myTitle: title,
            items: missingPackages,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            openType: OpenType.file,
        }, panelMissing, context, config);

        panelModified.webview.html = WebContentUtils.getModifiedWebContent({
            myTitle: title,
            items: modifiedPackages,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            openType: OpenType.diff,
        }, panelModified, context, config);

        panelCreated.webview.html = WebContentUtils.getCreatedWebContent({
            myTitle: title,
            items: createdPackages,
            transferIndividual: 1,
            showServerInfo: 1,
            showSourceServer: true,
            openType: OpenType.file,
        }, panelCreated, context, config);

        panelUnchanged.webview.html = WebContentUtils.getUnchangedWebContent({
            myTitle: title,
            items: unchangedPackages,
            transferIndividual: 0,
            showServerInfo: 0,
            openType: OpenType.diff,
        }, panelUnchanged, context, config);

        panelUnchanged.webview.onDidReceiveMessage(async message => {
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

        panelModified.webview.onDidReceiveMessage(async message => {
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
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                        );

                        // send message back
                        panelModified.webview.postMessage({
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

        panelMissing.webview.onDidReceiveMessage(async message => {
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
                            message.destFqdn,
                            message.destUsername,
                            message.destPassword,
                            path,
                            targetPath,
                            signingKey!,
                            message.name,
                        );

                        // send message back
                        panelMissing.webview.postMessage({
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

        panelCreated.webview.onDidReceiveMessage(async message => {
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
        destFqdn: string,
        username: string,
        password: string,
        filePath: string,
        targetFilePath: string,
        signingKey: SigningKey,
        packageName: string
    ) {
        const p = new Promise(async (resolve, reject) => {
            try {
                OutputChannelLogging.initialize();

                // get package data from file
                const packageSpecFromFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                // generate import json
                const importJson = {
                    object_list: packageSpecFromFile,
                    version: 2
                };

                // get signed content
                const signedContentData = await SigningUtils.retrieveSignedContent(importJson, signingKey);
                const signedContent = signedContentData.content;
                const tempPath = signedContentData.path;

                try {
                    // get session
                    const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, destFqdn, username, password);

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

                    for (var i = 0; i < packageSpec.files.length; i++) {
                        var packageFile = packageSpec.files[i];

                        if (packageFile.source.length === 0) {
                            OutputChannelLogging.log(`processing ${packageFile.name}`);

                            // download file to temp dir
                            const tempDir = os.tmpdir();
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
}