import { ExtensionContext } from 'vscode';
import * as contentset from './services/ContentSet';
import * as serverServer from './services/ServerServer';
import * as signContentFile from './services/SignContentFile';
import * as sensor from './services/Sensor';
import { OutputChannelLogging } from './common/logging';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	OutputChannelLogging.initialize();

	contentset.activate(context);
	serverServer.activate(context);
	signContentFile.activate(context);
	sensor.activate(context);
	
}

// this method is called when your extension is deactivated
export function deactivate() { }
