import * as vscode from 'vscode';

export class TaniumSolutionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly parent: TaniumSolutionTreeItem | undefined,
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri },
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}