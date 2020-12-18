import * as vscode from 'vscode';

export class TaniumDiffTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
    ) {
        super(label);
    }
}