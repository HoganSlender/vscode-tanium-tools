import * as vscode from 'vscode';
import { SolutionDiffItemData } from './TaniumDiffProvider';

export class TaniumDiffTreeItem extends vscode.TreeItem {
    constructor(
        public readonly diffItemData: SolutionDiffItemData,
    ) {
        super(diffItemData.label);
    }

	public command = {
		arguments: [this.label, this.diffItemData.leftDir, this.diffItemData.rightDir],
		command: 'hoganslendertanium.analyzeSolutions',
		title: 'Open Comparison',
	};
}