import path = require('path');
import * as vscode from 'vscode';
import { TaniumTreeItem } from './TaniumTreeItem';

export function activate(context: vscode.ExtensionContext) {
    const taniumNodeProvider = new TaniumNodeProvider(context.asAbsolutePath('resources'));
    vscode.window.registerTreeDataProvider('hoganslendertaniumdiff', taniumNodeProvider);
}

export class TaniumNodeProvider implements vscode.TreeDataProvider<TaniumTreeItem> {

    constructor(private resourcePath: string) {
    }

    private _onDidChangeTreeData: vscode.EventEmitter<TaniumTreeItem | undefined | void> = new vscode.EventEmitter<TaniumTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TaniumTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TaniumTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: TaniumTreeItem): Thenable<TaniumTreeItem[]> {
        if (element) {
            // children
            const children: TaniumTreeItem[] = [];

            switch (element.label) {
                case 'Content':
                    children.push(new TaniumTreeItem('Compare Content Sets', 'Compare Tanium Server Content Sets', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSets',
                        'title': 'Compare Tanium Server Content Sets',
                    }));
                    children.push(new TaniumTreeItem('Compare Content Set Privileges', 'Compare Tanium Server Content Set Privileges', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSetPrivileges',
                        'title': 'Compare Tanium Server Content Set Privileges',
                    }));
                    children.push(new TaniumTreeItem('Compare Content Set Roles', 'Compare Tanium Server Content Set Roles', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSetRoles',
                        'title': 'Compare Tanium Server Content Set Roles',
                    }));
                    children.push(new TaniumTreeItem('Compare Content Set Role Privileges', 'Compare Tanium Server Content Set Role Privileges', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSetRolePrivileges',
                        'title': 'Compare Tanium Server Content Set Role Privileges',
                    }));
                    children.push(new TaniumTreeItem('Compare Sensors', 'Compare Tanium Server Sensors', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerSensors',
                        'title': 'Compare Tanium Server Sensors',
                    }));
                    children.push(new TaniumTreeItem('Compare Packages', 'Compare Tanium Server Packages', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerPackages',
                        'title': 'Compare Tanium Server Packages',
                    }));
                    children.push(new TaniumTreeItem('Compare Groups - Action', 'Compare Tanium Server Groups - Action', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerActionGroups',
                        'title': 'Compare Tanium Server Groups - Action',
                    }));
                    children.push(new TaniumTreeItem('Compare Groups - Action Policy', 'Compare Tanium Server Groups - Action Policy', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerActionPolicyGroups',
                        'title': 'Compare Tanium Server Groups - Action Policy',
                    }));
                    children.push(new TaniumTreeItem('Compare Groups - Ad Hoc', 'Compare Tanium Server Groups - Ad Hoc', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerAdHocGroups',
                        'title': 'Compare Tanium Server Groups - Ad Hoc',
                    }));
                    children.push(new TaniumTreeItem('Compare Groups - Filter', 'Compare Tanium Server Groups - Filter', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerFilterGroups',
                        'title': 'Compare Tanium Server Groups - Filter',
                    }));
                    children.push(new TaniumTreeItem('Compare Groups - Manual', 'Compare Tanium Server Groups - Manual', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerManualGroups',
                        'title': 'Compare Tanium Server Groups - Manual',
                    }));
                    children.push(new TaniumTreeItem('Compare Users', 'Compare Tanium Server Users', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerUsers',
                        'title': 'Compare Tanium Server Users',
                    }));
                    children.push(new TaniumTreeItem('Compare User Groups', 'Compare Tanium Server User Groups', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerUserGroups',
                        'title': 'Compare Tanium Server User Groups',
                    }));
                    children.push(new TaniumTreeItem('Compare Content Set Role Memberships', 'Compare Tanium Server Content Set Role Memberships', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSetRoleMemberships',
                        'title': 'Compare Tanium Server Content Set Role Memberships',
                    }));
                    children.push(new TaniumTreeItem('Compare Content Set User Group Role Memberships', 'Compare Tanium Server Content Set User Group Role Memberships', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerContentSetUserGroupRoleMemberships',
                        'title': 'Compare Tanium Server Content Set User Group Role Memberships',
                    }));
                    children.push(new TaniumTreeItem('Compare Dashboards', 'Compare Tanium Server Dashboards', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerDashboards',
                        'title': 'Compare Tanium Server Dashboards',
                    }));
                    children.push(new TaniumTreeItem('Compare Dashboard Groups', 'Compare Tanium Server Dashboard Groups', vscode.TreeItemCollapsibleState.None, undefined, {
                        'command': 'hoganslendertanium.compareServerServerDashboardGroups',
                        'title': 'Compare Tanium Server Dashboard Groups',
                    }));
                    break;

                case 'Modules':
                    break;
            }

            return Promise.resolve(children);
        } else {
            // roots
            const roots: TaniumTreeItem[] = [];

            roots.push(new TaniumTreeItem('Content', 'Tanium base content', vscode.TreeItemCollapsibleState.Expanded, {
                light: path.join(this.resourcePath, 'light', 'folder.svg'),
                dark: path.join(this.resourcePath, 'dark', 'folder.svg')
            }));

            roots.push(new TaniumTreeItem('Modules', 'Tanium module content', vscode.TreeItemCollapsibleState.Collapsed, {
                light: path.join(this.resourcePath, 'light', 'folder.svg'),
                dark: path.join(this.resourcePath, 'dark', 'folder.svg')
            }));

            return Promise.resolve(roots);
        }
    }

}