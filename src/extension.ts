import { ExtensionContext } from 'vscode';
import * as contentset from './ContentSet';
import * as serverServer from './ServerServer';
import { OutputChannelLogging } from './logging';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	OutputChannelLogging.initialize();

	contentset.activate(context);
	serverServer.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
