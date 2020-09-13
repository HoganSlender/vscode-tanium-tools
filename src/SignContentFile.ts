import * as vscode from 'vscode';
import * as commands from './common/commands';
import { OutputChannelLogging } from './logging';
import { collectSignContentFileInputs } from './sign-content_file-parameters';


export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.signContentFile': (uri: vscode.Uri) => {
            SignContentFile.signContentFile(uri, context);
        },
    });
}

class SignContentFile {
    public static async signContentFile(target: vscode.Uri, context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();
        
        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');
        
        const state = await collectSignContentFileInputs(config, context);

        if (state.selectedItem === undefined) {
            // something was cancelled, exit
            return;
        }

        // collect values
        const keyUtilityPath = state.selectedItem.keyUtilityPath;
        const privateKeyFilePath = state.selectedItem.privateKeyFilePath;

        OutputChannelLogging.showClear();
        
        OutputChannelLogging.log(`Key utility path: ${keyUtilityPath}`);
        OutputChannelLogging.log(`private key file path: ${privateKeyFilePath}`);
   }
}