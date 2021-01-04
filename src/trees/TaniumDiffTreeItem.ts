import * as vscode from 'vscode';
import { SolutionDiffItemData } from './TaniumDiffProvider';

export class TaniumDiffTreeItem extends vscode.TreeItem {
    constructor(
        public readonly diffItemData: SolutionDiffItemData,
    ) {
        super(diffItemData.diffItems ? diffItemData.commandString
            ? `${diffItemData.label} (${diffItemData.diffItems.missing.length}:${diffItemData.diffItems.modified.length}:${diffItemData.diffItems.created.length}:${diffItemData.diffItems.unchanged.length})`
            : `${diffItemData.label} (${diffItemData.diffItems.missing.length}:${diffItemData.diffItems.modified.length}:${diffItemData.diffItems.unchanged.length})`
            : diffItemData.label);
    }

    public command = this.diffItemData.commandString
        ? {
            arguments: [undefined, [vscode.Uri.file(this.diffItemData.leftDir), vscode.Uri.file(this.diffItemData.rightDir)]],
            command: this.diffItemData.commandString,
            title: 'Open Comparison',
        }
        : {
            arguments: [this.diffItemData.label, this.diffItemData.diffItems],
            command: 'hoganslendertanium.analyzeSolutions',
            title: 'Open Comparison',
        };

    public contextValue = 'diffItem';
}