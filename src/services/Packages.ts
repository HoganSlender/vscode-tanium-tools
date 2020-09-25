import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import path = require('path');


import { OutputChannelLogging } from '../common/logging';

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

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
        const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

        OutputChannelLogging.log(`left dir: ${left.fsPath}`);
        OutputChannelLogging.log(`right dir: ${right.fsPath}`);

        const missingPackages = await this.getMissingPackages(left.fsPath, right.fsPath);

        panel.webview.html = this.getWebContent(missingPackages, panel, context, config);

        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'transferPackage':
                    this.transferPackage(allowSelfSignedCerts, httpTimeout, message);
                    break;
            }
        });
    }

    static transferPackage(allowSelfSignedCerts: boolean, httpTimeout: number, message: any) {
        const fqdn = message.fqdn;
        const username = message.username;
        const password = message.password;
    }

    static getMissingPackages(leftDir: string, rightDir: string): Promise<string[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var missing: string[] = [];

            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                const leftTarget = path.join(leftDir, file);
                const rightTarget = leftTarget.replace(leftDir, rightDir);

                if (!fs.existsSync(rightTarget)) {
                    const leftContent = fs.readFileSync(leftTarget, 'utf-8');

                    var packageObj: any = JSON.parse(leftContent);
                    missing.push(packageObj.display_name);
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

    static getWebContent(missingPackages: string[], panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdns: string[] = config.get('fqdns', []);

        // get usernames
        const usernames: string[] = config.get('usernames', []);

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
            html = html + `<option value="${missingPackages[i]}">${missingPackages[i]}</option>`;
        }


        html = html + `</select></td>
        <td><button type="button" id="addButton">></button><br/><br/><button type="button" id="removeButton"><</button></td>
        <td><select id="spackages" name="spackages" multiple="multiple" size="40" style="min-width: 600px;min-height: 800px;"/></td>
        </tr>
        <tr>
            <td colspan="3" align="right">
                <table>
                    <tr>
                        <td>Tanium Server FQDN</td>
                        <td><div id="divFqdn"/></td>
                    </tr>
                    <tr>
                        <td>Tanium Server Username</td>
                        <td><div id="divUsername"/></td>
                    </tr>
                    <tr>
                        <td>Tanium Server Password</td>
                        <td><input id="taniumServerPassword" type="password"/></td>
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

        // add fqdns
        for (var i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            if (i === usernames.length - 1) {
                html = html + username;
            } else {
                html = html + `${username},`;
            }
        }
        
        html = html + `</div>`;

        html = html + `<script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
</html>`;

        return html;
    }
}