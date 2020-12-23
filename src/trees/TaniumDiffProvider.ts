import * as fs from 'fs';
import * as vscode from 'vscode';
import { TaniumDiffTreeItem } from './TaniumDiffTreeItem';

const TANIUM_CONTENT_SET_DIFFS = 'taniumContentSetDiffs';
const TANIUM_CONTENT_SET_DIFF_LABELS = 'taniumContentSetDiffLabels';

export function activate(context: vscode.ExtensionContext) {
    const taniumDiffProvider = TaniumDiffProvider.createProvider(context);
    vscode.window.registerTreeDataProvider('hoganslendertaniumdiff', taniumDiffProvider);
}

export interface SolutionDiffItemData {
    label: string,
    leftDir: string,
    rightDir: string,
}

export class TaniumDiffProvider implements vscode.TreeDataProvider<TaniumDiffTreeItem> {
    constructor(private context: vscode.ExtensionContext) {
        this.diffItemDatas = context.workspaceState.get(TANIUM_CONTENT_SET_DIFFS) || [];
        this.diffLabels = context.workspaceState.get(TANIUM_CONTENT_SET_DIFF_LABELS) || [];

        // TODO: validate that target folders exist; if not then remove it
        this.validateDiffItemDatas(context);

        vscode.workspace.onDidDeleteFiles((e: vscode.FileDeleteEvent) => {
            const deletes: SolutionDiffItemData[] = [];

            e.files.forEach(file => {
                this.diffItemDatas.forEach(diffItemData => {
                    if (diffItemData.leftDir.includes(file.fsPath) || diffItemData.rightDir.includes(file.fsPath)) {
                        // need to delete
                        deletes.push(diffItemData);
                    }
                });

                deletes.forEach(diffItemData => {
                    this.diffItemDatas = this.diffItemDatas.filter(f => {
                        diffItemData.label === f.label;
                    });
                });

                if (deletes.length !== 0) {
                    // update labels
                    this.diffLabels = [];
                    this.diffItemDatas.forEach(diffItemData => {
                        this.diffLabels.push(diffItemData.label);
                    });

                    this.storeWorkspaceState(context);
                }
            });

            this.refresh();
        });
    }

    validateDiffItemDatas(context: vscode.ExtensionContext) {
        const deletes: SolutionDiffItemData[] = [];

        // walk the diffs and see if folder exits; if not then remove diff item data
        this.diffItemDatas.forEach(diffItemData => {
            if (!fs.existsSync(diffItemData.leftDir) || !fs.existsSync(diffItemData.rightDir)) {
                deletes.push(diffItemData);
            }
        });

        deletes.forEach(diffItemData => {
            this.diffItemDatas = this.diffItemDatas.filter(f => {
                diffItemData.label === f.label;
            });
        });

        if (deletes.length !== 0) {
            // update labels
            this.diffLabels = [];
            this.diffItemDatas.forEach(diffItemData => {
                this.diffLabels.push(diffItemData.label);
            });

            this.storeWorkspaceState(context);
        }
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public static currentProvider: TaniumDiffProvider | undefined;

    private diffItemDatas: SolutionDiffItemData[];
    private diffLabels: string[];

    private storeWorkspaceState(context: vscode.ExtensionContext) {
        context.workspaceState.update(TANIUM_CONTENT_SET_DIFFS, this.diffItemDatas);
        context.workspaceState.update(TANIUM_CONTENT_SET_DIFF_LABELS, this.diffLabels);
    }

    public addDiffData(diffItemData: SolutionDiffItemData, context: vscode.ExtensionContext) {
        if (this.diffLabels.includes(diffItemData.label)) {
            return;
        }

        this.diffItemDatas.push(diffItemData);
        this.diffLabels.push(diffItemData.label);

        // sort by label
        this.diffItemDatas.sort((a: any, b: any) => (a.label > b.label) ? 1 : -1);

        // store for later
        this.storeWorkspaceState(context);

        this.refresh();
    }

    static createProvider(context: vscode.ExtensionContext) {
        return TaniumDiffProvider.currentProvider || (TaniumDiffProvider.currentProvider = new TaniumDiffProvider(context));
    }

    private _onDidChangeTreeData: vscode.EventEmitter<TaniumDiffTreeItem | undefined | void> = new vscode.EventEmitter<TaniumDiffTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TaniumDiffTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TaniumDiffTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TaniumDiffTreeItem): vscode.ProviderResult<TaniumDiffTreeItem[]> {
        const children: TaniumDiffTreeItem[] = [];
        if (!element) {
            this.diffItemDatas.forEach(diffData => {
                children.push(new TaniumDiffTreeItem(diffData));
            });
        }

        return Promise.resolve(children);
    }
}