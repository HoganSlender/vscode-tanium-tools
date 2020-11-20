import * as vscode from 'vscode';
import * as pug from 'pug';

export class WebContentUtils {
    static getMissingWebContent(pugData: any, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        return this.getBaseWebContent(pugData, 'missing.js', 'missing.pug', panel, context, config);
    }

    static getModifiedWebContent(pugData: any, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        return this.getBaseWebContent(pugData, 'modified.js', 'modified.pug', panel, context, config);
    }

    static getCreatedWebContent(pugData: any, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        return this.getBaseWebContent(pugData, 'created.js', 'created.pug', panel, context, config);
    }

    static getUnchangedWebContent(pugData: any, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
        return this.getBaseWebContent(pugData, 'unchanged.js', 'unchanged.pug', panel, context, config);
    }

    static getBaseWebContent(pugData: any, scriptFile: string, pugFile: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): string {
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