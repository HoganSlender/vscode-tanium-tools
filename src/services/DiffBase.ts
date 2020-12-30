import * as vscode from 'vscode';
import { DiffItemData } from '../common/pathUtils';

export interface DiffPanels {
    missing: vscode.WebviewPanel,
    modified: vscode.WebviewPanel,
    created: vscode.WebviewPanel,
    unchanged: vscode.WebviewPanel
}

export interface SolutionDiffPanels {
    missing: vscode.WebviewPanel,
    modified: vscode.WebviewPanel,
    unchanged: vscode.WebviewPanel
}

export class DiffBase {
    static createPanels(label: string, diffItems: DiffItemData): DiffPanels {
        var result: DiffPanels = {
            missing: vscode.window.createWebviewPanel(
                `hoganslenderMissing${label.replace(/\s/g, '')}`,
                `Missing ${label} (${diffItems.missing.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            ),
            modified: vscode.window.createWebviewPanel(
                `hoganslenderModified${label.replace(/\s/g, '')}`,
                `Modified ${label} (${diffItems.modified.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                },
            ),
            created: vscode.window.createWebviewPanel(
                `hoganslenderCreated${label.replace(/\s/g, '')}`,
                `Created ${label} (${diffItems.created.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                },
            ),
            unchanged: vscode.window.createWebviewPanel(
                `hoganslenderUnchanged${label.replace(/\s/g, '')}`,
                `Unchanged ${label} (${diffItems.unchanged.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                },
            )
        };

        return result;
    }

    static createSolutionPanels(label: string, diffItems: DiffItemData): SolutionDiffPanels {
        var result: SolutionDiffPanels = {
            missing: vscode.window.createWebviewPanel(
                `hoganslenderMissing${label.replace(/\s/g, '')}`,
                `Missing ${label} (${diffItems.missing.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            ),
            modified: vscode.window.createWebviewPanel(
                `hoganslenderModified${label.replace(/\s/g, '')}`,
                `Modified ${label} (${diffItems.modified.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                },
            ),
            unchanged: vscode.window.createWebviewPanel(
                `hoganslenderUnchanged${label.replace(/\s/g, '')}`,
                `Unchanged ${label} (${diffItems.unchanged.length})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                },
            )
        };

        return result;
    }
}