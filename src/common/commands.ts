import * as vscode from 'vscode';

export function register (context:vscode.ExtensionContext, commands:{ [command:string]: (...args:any) => void }) {
	for (const [command, callback] of Object.entries(commands)) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback));
	}
}
