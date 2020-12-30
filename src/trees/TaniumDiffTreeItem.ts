import * as vscode from 'vscode';
import { SolutionDiffItemData } from './TaniumDiffProvider';

export class TaniumDiffTreeItem extends vscode.TreeItem {
    constructor(
        public readonly diffItemData: SolutionDiffItemData,
    ) {
        super(diffItemData.diffItems ? `${diffItemData.label} (${diffItemData.diffItems.missing.length}:${diffItemData.diffItems.modified.length}:${diffItemData.diffItems.unchanged.length})` : diffItemData.label);
    }

	public command = {
		arguments: [this.diffItemData.label, this.diffItemData.diffItems],
		command: 'hoganslendertanium.analyzeSolutions',
		title: 'Open Comparison',
	};
}