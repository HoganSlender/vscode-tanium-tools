/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import path = require('path');
import * as pug from 'pug';
import { OutputChannelLogging } from '../common/logging';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetPrivileges': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetPrivileges.analyzeContentSetPrivileges(uris[0], uris[1], context);
        },
    });
}

export class ContentSetPrivileges {
    static async analyzeContentSetPrivileges(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        const panelMissing = vscode.window.createWebviewPanel(
            'hoganslenderMissingContentSetPrivileges',
            'Missing Content Set Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelModified = vscode.window.createWebviewPanel(
            'hoganslenderModifiedContentSetPrivileges',
            'Modified Content Set Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelCreated = vscode.window.createWebviewPanel(
            'hoganslenderCreatedContentSetPrivileges',
            'Created Content Set Privileges',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const panelUnchanged = vscode.window.createWebviewPanel(
            'hoganslenderUnchangedContentSetPrivileges',
            'Unchanged Content Set Privileges',
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

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const missingContentSetPrivileges = await this.getMissingContentSetPrivileges(left.fsPath, right.fsPath);
        const modifiedContentSetPrivileges = await this.getModifiedContentSetPrivileges(left.fsPath, right.fsPath);
        const createdContentSetPrivileges = await this.getCreatedContentSetPrivileges(left.fsPath, right.fsPath);
        const unchangedContentSetPrivileges = await this.getUnchangedContentSetPrivileges(left.fsPath, right.fsPath);

        OutputChannelLogging.log(`missing content set privileges: ${missingContentSetPrivileges.length}`);
        OutputChannelLogging.log(`modified content set privileges: ${modifiedContentSetPrivileges.length}`);
        OutputChannelLogging.log(`created content set privileges: ${createdContentSetPrivileges.length}`);
        OutputChannelLogging.log(`unchanged content set privileges: ${unchangedContentSetPrivileges.length}`);

        panelMissing.webview.html = this.getMissingWebContent(missingContentSetPrivileges, panelMissing, context, config);
        panelModified.webview.html = this.getModifiedWebContent(modifiedContentSetPrivileges, panelModified, context, config);
        panelCreated.webview.html = this.getCreatedWebContent(createdContentSetPrivileges, panelCreated, context, config);
        panelUnchanged.webview.html = this.getUnchangedWebContent(unchangedContentSetPrivileges, panelUnchanged, context, config);

        panelUnchanged.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case "openDiff":
                        var items = message.path.split('~');
                        var lPath = items[0];
                        var rPath = items[2];
                        var title = `${message.name}.json (${this.getPath(lPath)} ↔ ${this.getPath(rPath)})`;
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

                    case 'transferItems':
                        await this.transferItems(
                            message.items,
                        );
                        break;

                    case "openDiff":
                        var diffItems = message.path.split('~');
                        var lPath = diffItems[0];
                        var rPath = diffItems[2];
                        var title = `${message.name}.json (${this.getPath(lPath)} ↔ ${this.getPath(rPath)})`;
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

                    case 'transferItems':
                        await this.transferItems(
                            message.items,
                        );
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

    static getPath(input: string): string {
        var items = input.split(path.sep);

        return input.replace(path.sep + items[items.length - 1], '');
    }

    static getMissingContentSetPrivileges(leftDir: string, rightDir: string): Promise<any[]> {
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
                        path: leftTarget + '~~' + rightTarget,
                    });
                }

                if (i === files.length - 1) {
                    resolve(missing);
                }
            }
        });

        return p;
    }

    static getModifiedContentSetPrivileges(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var modified: any[] = [];

            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                const leftTarget = path.join(leftDir, file);
                const rightTarget = leftTarget.replace(leftDir, rightDir);

                if (fs.existsSync(rightTarget)) {
                    // compare left and right contents
                    var lContents = fs.readFileSync(leftTarget, 'utf-8');
                    var rContents = fs.readFileSync(rightTarget, 'utf-8');

                    if (lContents !== rContents) {
                        modified.push({
                            name: file.replace('.json', ''),
                            path: leftTarget + '~~' + rightTarget,
                        });
                    }
                }

                if (i === files.length - 1) {
                    resolve(modified);
                }
            }
        });

        return p;
    }

    static getCreatedContentSetPrivileges(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(rightDir);
            var created: any[] = [];

            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                const rightTarget = path.join(rightDir, file);
                const leftTarget = rightTarget.replace(rightDir, leftDir);

                if (!fs.existsSync(leftTarget)) {
                    created.push({
                        name: file.replace('.json', ''),
                        path: rightTarget
                    });
                }

                if (i === files.length - 1) {
                    resolve(created);
                }
            }
        });

        return p;
    }

    static getUnchangedContentSetPrivileges(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var unchanged: any[] = [];

            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                const leftTarget = path.join(leftDir, file);
                const rightTarget = leftTarget.replace(leftDir, rightDir);

                if (fs.existsSync(rightTarget)) {
                    // compare left and right contents
                    var lContents = fs.readFileSync(leftTarget, 'utf-8');
                    var rContents = fs.readFileSync(rightTarget, 'utf-8');

                    if (lContents === rContents) {
                        unchanged.push({
                            name: file.replace('.json', ''),
                            path: leftTarget + '~~' + rightTarget,
                        });
                    }
                }

                if (i === files.length - 1) {
                    resolve(unchanged);
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

    static getMissingWebContent(missingContentSetPrivileges: any[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdnsString: string = config.get('fqdns', []).join();

        // get usernames
        const usernamesString: string = config.get('usernames', []).join();

        // get signing keys
        const signingKeys: any[] = config.get<any>('signingPaths', []);
        const signingKeysString: string = signingKeys.map(key => key.serverLabel).join();

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'missing.js');
        const pugPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'missing.pug');

        // And the uri we use to load this script in the webview
        const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        const compiledFunction = pug.compileFile(pugPathOnDisk.fsPath, {
            pretty: true
        });

        const html = compiledFunction({
            myTitle: 'Content Set Privileges',
            panelWebviewCspSource: panel.webview.cspSource,
            nonce: nonce,
            missingItems: missingContentSetPrivileges,
            fqdns: fqdnsString,
            usernames: usernamesString,
            signingKeys: signingKeysString,
            scriptUri: scriptUri,
            transferIndividual: 0,
            showServerInfo: 0,
        });

        return html;
    }

    static getModifiedWebContent(modifiedContentSetPrivileges: any[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdnsString: string = config.get('fqdns', []).join();

        // get usernames
        const usernamesString: string = config.get('usernames', []).join();

        // get signing keys
        const signingKeys: any[] = config.get<any>('signingPaths', []);
        const signingKeysString: string = signingKeys.map(key => key.serverLabel).join();

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'modified.js');
        const pugPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'modified.pug');

        // And the uri we use to load this script in the webview
        const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        const compiledFunction = pug.compileFile(pugPathOnDisk.fsPath, {
            pretty: true
        });

        const html = compiledFunction({
            myTitle: 'Content Set Privileges',
            panelWebviewCspSource: panel.webview.cspSource,
            nonce: nonce,
            modifiedItems: modifiedContentSetPrivileges,
            fqdns: fqdnsString,
            usernames: usernamesString,
            signingKeys: signingKeysString,
            scriptUri: scriptUri,
            transferIndividual: 0,
            showServerInfo: 0,
        });

        return html;
    }

    static getCreatedWebContent(createdContentSetPrivileges: any[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdnsString: string = config.get('fqdns', []).join();

        // get usernames
        const usernamesString: string = config.get('usernames', []).join();

        // get signing keys
        const signingKeys: any[] = config.get<any>('signingPaths', []);
        const signingKeysString: string = signingKeys.map(key => key.serverLabel).join();

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'created.js');
        const pugPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'created.pug');

        // And the uri we use to load this script in the webview
        const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        const compiledFunction = pug.compileFile(pugPathOnDisk.fsPath, {
            pretty: true
        });

        const html = compiledFunction({
            myTitle: 'Content Set Privileges',
            panelWebviewCspSource: panel.webview.cspSource,
            nonce: nonce,
            createdItems: createdContentSetPrivileges,
            fqdns: fqdnsString,
            usernames: usernamesString,
            signingKeys: signingKeysString,
            scriptUri: scriptUri,
            transferIndividual: 0,
            showServerInfo: 0,
        });

        return html;
    }

    static getUnchangedWebContent(unchangedContentSetPrivileges: any[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'unchanged.js');
        const pugPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', 'unchanged.pug');

        // And the uri we use to load this script in the webview
        const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        const compiledFunction = pug.compileFile(pugPathOnDisk.fsPath, {
            pretty: true
        });

        const html = compiledFunction({
            myTitle: 'Content Set Privileges',
            panelWebviewCspSource: panel.webview.cspSource,
            nonce: nonce,
            unchangedItems: unchangedContentSetPrivileges,
            scriptUri: scriptUri
        });

        return html;
    }

    static async transferItems(items: any[]) {
        // generate json
        var importJson = {
            object_list: {
                content_set_privileges: []
            },
            version: 2
        };

        var content_set_privileges: any = [];

        for (var i = 0; i < items.length; i++) {
            const item = items[i];

            const path = item.path.split('~')[0];
            const name = item.name;

            // get content set data from file
            const contentSetFromFile: any = JSON.parse(fs.readFileSync(path, 'utf-8'));

            // add to importJson
            content_set_privileges.push(contentSetFromFile);
        }

        importJson.object_list.content_set_privileges = content_set_privileges;

        // save file to base
        const baseDir = this.getPath(this.getPath(items[0].path.split('~')[0]));
        const tempPath = path.join(baseDir, uuidv4() + '.json');
        fs.writeFileSync(tempPath, `${JSON.stringify(importJson, null, 2)}\r\n`, 'utf-8');

        // open file
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(tempPath), {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
        });
    }
}