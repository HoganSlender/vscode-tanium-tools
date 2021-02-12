import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as vscode from 'vscode';
import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { DiffItemData, PathUtils } from '../common/pathUtils';
import { TaniumDiffTreeItem } from './TaniumDiffTreeItem';

const TANIUM_CONTENT_SET_DIFFS = 'taniumContentSetDiffs';
const TANIUM_CONTENT_SET_DIFF_LABELS = 'taniumContentSetDiffLabels';
const TANIUM_CONTENT_SET_XML_FILES = 'taniumContentSetXmlFiles';

export function activate(context: vscode.ExtensionContext) {
    const taniumDiffProvider = TaniumDiffProvider.createProvider(context);
    vscode.window.registerTreeDataProvider('hoganslendertaniumdiff', taniumDiffProvider);

    commands.register(context, {
        'hoganslendertanium.removeDiffItem': (node: TaniumDiffTreeItem) => {
            TaniumDiffProvider.currentProvider?.removeItem(node, context);
        },
        'hoganslendertanium.removeDiffItems': (node: TaniumDiffTreeItem) => {
            TaniumDiffProvider.currentProvider?.removeItems(context);
        },
    });
}

export interface SolutionContentSetData {
    xmlContentSetFile: string,
    leftDir: string,
    rightDir: string,
}

export interface SolutionDiffItemData {
    label: string,
    leftDir: string,
    rightDir: string,
    diffItems?: DiffItemData,
    commandString: string
}

export class TaniumDiffProvider implements vscode.TreeDataProvider<TaniumDiffTreeItem> {
    constructor(private context: vscode.ExtensionContext) {
        this.diffItemDatas = context.workspaceState.get(TANIUM_CONTENT_SET_DIFFS) || [];
        this.diffLabels = context.workspaceState.get(TANIUM_CONTENT_SET_DIFF_LABELS) || [];
        this.solutionContentSetDatas = context.workspaceState.get(TANIUM_CONTENT_SET_XML_FILES) || [];

        this.validateDiffItemDatas(context);
        this.validateXmlContentSetFiles(context);

        vscode.workspace.onDidDeleteFiles((e: vscode.FileDeleteEvent) => {
            e.files.forEach(file => {
                this.processDeleteDiffItemDatas(file, context);
                this.processDeleteSolutionContentSetData(file, context);
            });

            this.refresh();
        });
    }

    private processDeleteSolutionContentSetData(file: vscode.Uri, context: vscode.ExtensionContext) {
        const deletes: SolutionContentSetData[] = [];

        this.solutionContentSetDatas.forEach(solutionContentSetData => {
            if (solutionContentSetData.xmlContentSetFile === file.fsPath || solutionContentSetData.leftDir === file.fsPath || solutionContentSetData.rightDir === file.fsPath) {
                // need to delete
                deletes.push(solutionContentSetData);
            }
        });

        deletes.forEach(solutionContentSetData => {
            this.solutionContentSetDatas = this.solutionContentSetDatas.filter(f => solutionContentSetData.xmlContentSetFile !== f.xmlContentSetFile);
        });

        if (deletes.length !== 0) {
            this.storeWorkspaceState(context);
        }
    }

    private processDeleteDiffItemDatas(file: vscode.Uri, context: vscode.ExtensionContext) {
        const deletes: SolutionDiffItemData[] = [];

        this.diffItemDatas.forEach(diffItemData => {
            if (diffItemData.leftDir.includes(file.fsPath) || diffItemData.rightDir.includes(file.fsPath)) {
                // need to delete
                deletes.push(diffItemData);
            }
        });

        deletes.forEach(diffItemData => {
            this.diffItemDatas = this.diffItemDatas.filter(f => diffItemData.label !== f.label);
            this.diffLabels = this.diffLabels.filter(f => diffItemData.label !== f);
        });

        if (deletes.length !== 0) {
            this.storeWorkspaceState(context);
        }
    }

    validateXmlContentSetFiles(context: vscode.ExtensionContext) {
        const deletes: SolutionContentSetData[] = [];

        // walk the diffs and see if folder exists; if not then remove diff item data
        this.solutionContentSetDatas.forEach(contentSetData => {
            // check for xmlContentSetFile for blank
            if (contentSetData.xmlContentSetFile.length === 0) {
                if (!fs.existsSync(contentSetData.leftDir) || !fs.existsSync(contentSetData.rightDir)) {
                    deletes.push(contentSetData);
                }
            } else {
                if (!fs.existsSync(contentSetData.xmlContentSetFile) || !fs.existsSync(contentSetData.leftDir) || !fs.existsSync(contentSetData.rightDir)) {
                    deletes.push(contentSetData);
                }
            }
        });

        deletes.forEach(solutionContentSetData => {
            this.solutionContentSetDatas = this.solutionContentSetDatas.filter(f => solutionContentSetData.xmlContentSetFile !== f.xmlContentSetFile);
        });

        if (deletes.length !== 0) {
            this.storeWorkspaceState(context);
        }
    }

    validateDiffItemDatas(context: vscode.ExtensionContext) {
        const deletes: SolutionDiffItemData[] = [];

        // walk the diffs and see if folder exists; if not then remove diff item data
        this.diffItemDatas.forEach(diffItemData => {
            if (!fs.existsSync(diffItemData.leftDir) || !fs.existsSync(diffItemData.rightDir)) {
                deletes.push(diffItemData);
            }
        });

        deletes.forEach(diffItemData => {
            this.diffItemDatas = this.diffItemDatas.filter(f => diffItemData.label !== f.label);
            this.diffLabels = this.diffLabels.filter(f => diffItemData.label !== f);
        });

        if (deletes.length !== 0) {
            this.storeWorkspaceState(context);
        }
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public static currentProvider: TaniumDiffProvider | undefined;

    private diffItemDatas: SolutionDiffItemData[];
    private diffLabels: string[];
    private solutionContentSetDatas: SolutionContentSetData[];

    private storeWorkspaceState(context: vscode.ExtensionContext) {
        context.workspaceState.update(TANIUM_CONTENT_SET_DIFFS, this.diffItemDatas);
        context.workspaceState.update(TANIUM_CONTENT_SET_DIFF_LABELS, this.diffLabels);
        context.workspaceState.update(TANIUM_CONTENT_SET_XML_FILES, this.solutionContentSetDatas);
    }

    public calculateDiffs(context: vscode.ExtensionContext) {
        const p = new Promise<void>(async (resolve, reject) => {
            try {
                const increment = 100 / this.diffItemDatas.length;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Calculate Differences',
                    cancellable: false
                }, async (progress) => {
                    progress.report({
                        increment: 0
                    });

                    for (var i = 0; i < this.diffItemDatas.length; i++) {
                        const diffItemData = this.diffItemDatas[i];
                        progress.report({
                            increment: increment,
                            message: `calculating diffs for ${diffItemData.label}`
                        });
                        diffItemData.diffItems = await PathUtils.getDiffItems(diffItemData.leftDir, diffItemData.rightDir, diffItemData.label === 'Sensors' ? true : false, true);
                    }

                    // store for later
                    this.storeWorkspaceState(context);

                    this.refresh();

                    return resolve();
                });
            } catch (err) {
                OutputChannelLogging.logError('error in TaniumDiffProvider.calculateDiffs', err);
                return reject();
            }
        });

        return p;
    }

    public addSolutionContentSetData(solutionContentSetData: SolutionContentSetData, context: vscode.ExtensionContext) {
        if (this.solutionContentSetDatas.filter(e => e.xmlContentSetFile === solutionContentSetData.xmlContentSetFile).length > 0) {
            // already here
            return;
        }

        this.solutionContentSetDatas.push(solutionContentSetData);

        // store for later
        this.storeWorkspaceState(context);

        // no ui update necessary
    }

    public async removeItems(context: vscode.ExtensionContext) {
        this.solutionContentSetDatas.forEach(solutionContentSetData => {
            if (fs.existsSync(solutionContentSetData.leftDir)) {
                rimraf.sync(solutionContentSetData.leftDir);
            }

            if (fs.existsSync(solutionContentSetData.rightDir)) {
                rimraf.sync(solutionContentSetData.rightDir);
            }

            if (fs.existsSync(solutionContentSetData.xmlContentSetFile)) {
                fs.unlinkSync(solutionContentSetData.xmlContentSetFile);
            }
        });

        this.diffItemDatas.forEach(diffItemData => {
            // remove left dir
            if (fs.existsSync(diffItemData.leftDir)) {
                rimraf.sync(diffItemData.leftDir);
            }

            // remove right dir
            if (fs.existsSync(diffItemData.rightDir)) {
                rimraf.sync(diffItemData.rightDir);
            }
        });

        // remove diffitemdatas
        this.diffItemDatas = [];
        this.diffLabels = [];
        this.solutionContentSetDatas = [];

        this.storeWorkspaceState(context);

        this.refresh();

        // clear out current windows
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    public removeItem(node: TaniumDiffTreeItem, context: vscode.ExtensionContext) {
        // remove left dir
        rimraf.sync(node.diffItemData.leftDir);

        // remove right dir
        rimraf.sync(node.diffItemData.rightDir);

        // remove diffitemdata
        this.diffItemDatas = this.diffItemDatas.filter(diffItemData => node.diffItemData.label !== diffItemData.label);
        this.diffLabels = this.diffLabels.filter(f => node.diffItemData.label !== f);

        this.storeWorkspaceState(context);

        this.refresh();
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