import { ExtensionContext } from 'vscode';
import * as contentset from './ContentSet';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	contentset.activate(context);

}

// this method is called when your extension is deactivated
export function deactivate() { }
