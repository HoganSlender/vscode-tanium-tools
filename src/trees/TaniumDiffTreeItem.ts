import * as vscode from 'vscode';
import { SolutionDiffItemData } from './TaniumDiffProvider';

export class TaniumDiffTreeItem extends vscode.TreeItem {
    constructor(
        public readonly diffItemData: SolutionDiffItemData,
    ) {
        super(diffItemData.diffItems ? diffItemData.commandString !== 'hoganslendertanium.analyzeSolutions'
            ? `${diffItemData.label} (${diffItemData.diffItems.missing.length}:${diffItemData.diffItems.modified.length}:${diffItemData.diffItems.created.length}:${diffItemData.diffItems.unchanged.length})`
            : `${diffItemData.label} (${diffItemData.diffItems.missing.length}:${diffItemData.diffItems.modified.length}:${diffItemData.diffItems.unchanged.length})`
            : diffItemData.label);
    }

    //public command = (this.diffItemData.commandString !== 'hoganslendertanium.analyzeSolutions' && this.diffItemData.commandString !== 'hoganslendertanium.analyzeModules')
    public command = this.diffItemData.useLabel
        ? {
            arguments: [this.diffItemData.label, this.diffItemData.diffItems],
            command: this.diffItemData.commandString,
            title: 'Open Comparison',
        }
        : {
            arguments: [this.diffItemData.diffItems],
            command: this.diffItemData.commandString,
            title: 'Open Comparison',
        };

    public contextValue = 'diffItem';
}