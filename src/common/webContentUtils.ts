import * as pug from 'pug';
import * as vscode from 'vscode';

import { OpenType } from './enums';

export interface WebContentData {
    myType?: string,
    myTitle: string,
    items: any[],
    transferIndividual: number,
    showServerInfo: number,
    showSourceServer?: boolean,
    showSourceCreds?: boolean,
    showDestServer: boolean,
    showSigningKeys?: boolean,
    openType: OpenType,
    panelWebviewCspSource?: string,
    scriptUri?: vscode.Uri,
    nonce?: string,
    fqdns?: string,
    usernames?: string,
    signingKeys?: string,
    readOnly?: boolean,
}

export class WebContentUtils {
    static getMissingWebContent(pugData: WebContentData, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        pugData.myType = 'Missing';
        return this.getBaseWebContent(pugData, 'editable.js', 'editable.pug', panel, context, config);
    }

    static getModifiedWebContent(pugData: WebContentData, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        pugData.myType = 'Modified';
        return this.getBaseWebContent(pugData, 'editable.js', 'editable.pug', panel, context, config);
    }

    static getCreatedWebContent(pugData: WebContentData, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        pugData.myType = 'Created';
        return this.getBaseWebContent(pugData, 'editable.js', 'editable.pug', panel, context, config);
    }

    static getUnchangedWebContent(pugData: WebContentData, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        pugData.myType = 'Unchanged';
        return this.getBaseWebContent(pugData, 'readonly.js', 'readonly.pug', panel, context, config);
    }

    static getBaseWebContent(pugData: WebContentData, scriptFile: string, pugFile: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        // get fqdns
        const fqdnsString: string = config.get('fqdns', []).join();

        // get usernames
        const usernamesString: string = config.get('usernames', []).join();

        // get signing keys
        const signingKeys: any[] = config.get<any>('signingPaths', []);
        const signingKeysString: string = signingKeys.map(key => key.serverLabel).join();

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', scriptFile);
        const pugPathOnDisk = vscode.Uri.joinPath(context.extensionUri, 'media', pugFile);
        
        pugData.panelWebviewCspSource = panel.webview.cspSource;
        pugData.scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);
        pugData.nonce = this.getNonce();
        pugData.fqdns = fqdnsString;
        pugData.usernames = usernamesString;
        pugData.signingKeys = signingKeysString;

        const compiledFunction = pug.compileFile(pugPathOnDisk.fsPath, {
            pretty: true
        });

        const html = compiledFunction(pugData);

        return html;
    }

    static getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}