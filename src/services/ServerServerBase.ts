import * as vscode from 'vscode';

import { OutputChannelLogging } from '../common/logging';

export class ServerServerBase {
    static invalidWorkspaceFolders(): boolean {
        if (!vscode.workspace.workspaceFolders) {
            OutputChannelLogging.showClear();
            OutputChannelLogging.log('You have not yet opened a folder. A workspace folder is required.');
            return true;
        }

        return false;
    }
}