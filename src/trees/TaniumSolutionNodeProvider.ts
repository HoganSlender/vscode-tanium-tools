import path = require('path');
import * as vscode from 'vscode';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';
import { SolutionData } from '../services/Solutions';
import { TaniumSolutionTreeItem } from './TaniumSolutionTreeItem';

export function activate(context: vscode.ExtensionContext) {
    const taniumSolutionNodeProvider = TaniumSolutionNodeProvider.createProvider(context);
    vscode.window.registerTreeDataProvider('hoganslendertaniumcompare', taniumSolutionNodeProvider);
}

export class TaniumSolutionNodeProvider implements vscode.TreeDataProvider<TaniumSolutionTreeItem> {
    constructor(private resourcePath: string) {
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    public static currentProvider: TaniumSolutionNodeProvider | undefined;

    label: string = '';

    private solutionData: SolutionData | undefined;
    private isRefreshing: boolean = false;

    public clearSolutionData() {
        this.solutionData = undefined;
        this.refresh();
    }

    public refreshSolutionData() {
        this.solutionData = undefined;
        this.isRefreshing = true;
        this.refresh();
    }

    public setSolutionData(data: SolutionData) {
        this.isRefreshing = false;
        this.solutionData = data;
        this.refresh();
    }

    public getSolutionDataFqdn(): FqdnSetting {
        return this.solutionData?.fqdn!;
    }

    public static createProvider(context: vscode.ExtensionContext) {
        return TaniumSolutionNodeProvider.currentProvider || (TaniumSolutionNodeProvider.currentProvider = new TaniumSolutionNodeProvider(context.asAbsolutePath('resources')));
    }

    private _onDidChangeTreeData: vscode.EventEmitter<TaniumSolutionTreeItem | undefined | void> = new vscode.EventEmitter<TaniumSolutionTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TaniumSolutionTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TaniumSolutionTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TaniumSolutionTreeItem): Thenable<TaniumSolutionTreeItem[]> {
        if (element) {
            // children
            const children: TaniumSolutionTreeItem[] = [];

            switch (element.label) {
                case 'Solutions':
                    if (this.solutionData === undefined) {
                        if (this.isRefreshing) {
                            children.push(new TaniumSolutionTreeItem(element, 'Updating...', 'Updating...', vscode.TreeItemCollapsibleState.None));
                        } else {
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Solutions', 'Compare Solutions to Tanium Server', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareSolutions',
                                'title': 'Compare Solutions',
                            }));
                        }
                    } else {
                        children.push(new TaniumSolutionTreeItem(element, 'Modules', 'Modules', vscode.TreeItemCollapsibleState.Expanded, {
                            light: path.join(this.resourcePath, 'light', 'folder.svg'),
                            dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                        }));

                        children.push(new TaniumSolutionTreeItem(element, 'Content', 'Content', vscode.TreeItemCollapsibleState.Expanded, {
                            light: path.join(this.resourcePath, 'light', 'folder.svg'),
                            dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                        }));
                    }
                    break;

                case this.label:
                    children.push(new TaniumSolutionTreeItem(element, 'Modules', 'Modules', vscode.TreeItemCollapsibleState.Expanded, {
                        light: path.join(this.resourcePath, 'light', 'folder.svg'),
                        dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                    }));

                    children.push(new TaniumSolutionTreeItem(element, 'Content', 'Content', vscode.TreeItemCollapsibleState.Expanded, {
                        light: path.join(this.resourcePath, 'light', 'folder.svg'),
                        dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                    }));
                    break;

                case 'Servers':
                    children.push(new TaniumSolutionTreeItem(element, 'Content', 'Tanium base content', vscode.TreeItemCollapsibleState.Expanded, {
                        light: path.join(this.resourcePath, 'light', 'folder.svg'),
                        dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                    }));

                    children.push(new TaniumSolutionTreeItem(element, 'Modules', 'Tanium module content', vscode.TreeItemCollapsibleState.Collapsed, {
                        light: path.join(this.resourcePath, 'light', 'folder.svg'),
                        dark: path.join(this.resourcePath, 'dark', 'folder.svg')
                    }));
                    break;

                case 'Content':
                    switch (element.parent?.label) {
                        case this.label:
                            // iterate through solutions
                            this.solutionData?.items?.forEach(solution => {
                                if (!solution.featured) {
                                    children.push(new TaniumSolutionTreeItem(
                                        element,
                                        `${solution.name}-${solution.current_version}`,
                                        solution.available_version === solution.current_version ? `${solution.name}` : `available version: ${solution.available_version}`,
                                        vscode.TreeItemCollapsibleState.None,
                                        solution.available_version === solution.current_version ? undefined : {
                                            light: path.join(this.resourcePath, 'light', 'exclamation.svg'),
                                            dark: path.join(this.resourcePath, 'dark', 'exclamation.svg')
                                        },
                                        {
                                            title: 'Compare Content Set Content',
                                            command: 'hoganslendertanium.compareContentSetContent',
                                            arguments: [this.solutionData?.fqdn, solution.content_url]
                                        }
                                    ));
                                }
                            });
                            break;

                        case 'Servers':
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Sets', 'Compare Tanium Server Content Sets', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSets',
                                'title': 'Compare Tanium Server Content Sets',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Set Privileges', 'Compare Tanium Server Content Set Privileges', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSetPrivileges',
                                'title': 'Compare Tanium Server Content Set Privileges',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Set Roles', 'Compare Tanium Server Content Set Roles', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSetRoles',
                                'title': 'Compare Tanium Server Content Set Roles',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Set Role Privileges', 'Compare Tanium Server Content Set Role Privileges', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSetRolePrivileges',
                                'title': 'Compare Tanium Server Content Set Role Privileges',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Sensors', 'Compare Tanium Server Sensors', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerSensors',
                                'title': 'Compare Tanium Server Sensors',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Packages', 'Compare Tanium Server Packages', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerPackages',
                                'title': 'Compare Tanium Server Packages',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Groups - Action', 'Compare Tanium Server Groups - Action', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerActionGroups',
                                'title': 'Compare Tanium Server Groups - Action',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Groups - Action Policy', 'Compare Tanium Server Groups - Action Policy', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerActionPolicyGroups',
                                'title': 'Compare Tanium Server Groups - Action Policy',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Groups - Ad Hoc', 'Compare Tanium Server Groups - Ad Hoc', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerAdHocGroups',
                                'title': 'Compare Tanium Server Groups - Ad Hoc',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Groups - Filter', 'Compare Tanium Server Groups - Filter', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerFilterGroups',
                                'title': 'Compare Tanium Server Groups - Filter',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Groups - Manual', 'Compare Tanium Server Groups - Manual', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerManualGroups',
                                'title': 'Compare Tanium Server Groups - Manual',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Users', 'Compare Tanium Server Users', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerUsers',
                                'title': 'Compare Tanium Server Users',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare User Groups', 'Compare Tanium Server User Groups', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerUserGroups',
                                'title': 'Compare Tanium Server User Groups',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Set Role Memberships', 'Compare Tanium Server Content Set Role Memberships', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSetRoleMemberships',
                                'title': 'Compare Tanium Server Content Set Role Memberships',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Content Set User Group Role Memberships', 'Compare Tanium Server Content Set User Group Role Memberships', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerContentSetUserGroupRoleMemberships',
                                'title': 'Compare Tanium Server Content Set User Group Role Memberships',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Dashboards', 'Compare Tanium Server Dashboards', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerDashboards',
                                'title': 'Compare Tanium Server Dashboards',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Dashboard Groups', 'Compare Tanium Server Dashboard Groups', vscode.TreeItemCollapsibleState.None, undefined, {
                                'command': 'hoganslendertanium.compareServerServerDashboardGroups',
                                'title': 'Compare Tanium Server Dashboard Groups',
                            }));
                            children.push(new TaniumSolutionTreeItem(element, 'Compare Saved Questions', 'Compare Tanium Server Saved Questions', vscode.TreeItemCollapsibleState.None, undefined, {
                                "command": "hoganslendertanium.compareServerServerSavedQuestions",
                                "title": "Compare Tanium Server Saved Questions",
                            }));
                            break;
                    }
                    break;

                case 'Modules':
                    switch (element.parent?.label) {
                        case this.label:
                            // iterate through solutions
                            this.solutionData?.items?.forEach(solution => {
                                if (solution.featured) {
                                    children.push(new TaniumSolutionTreeItem(
                                        element,
                                        `${solution.name}-${solution.current_version}`,
                                        solution.available_version === solution.current_version ? `${solution.name}` : `available version: ${solution.available_version}`,
                                        vscode.TreeItemCollapsibleState.None,
                                        solution.available_version === solution.current_version ? undefined : {
                                            light: path.join(this.resourcePath, 'light', 'exclamation.svg'),
                                            dark: path.join(this.resourcePath, 'dark', 'exclamation.svg')
                                        },
                                        {
                                            title: 'Compare Content Set Content',
                                            command: 'hoganslendertanium.compareContentSetContent',
                                            arguments: [this.solutionData?.fqdn, solution.content_url]
                                        }
                                    ));
                                }
                            });
                            break;

                        case 'Servers':
                            break;
                    }
                    break;
            }

            return Promise.resolve(children);
        } else {
            // roots
            const roots: TaniumSolutionTreeItem[] = [];

            this.label = this.solutionData ? `Solutions - ${this.solutionData.fqdn.label}` : 'Solutions';

            const serverSolutions = new TaniumSolutionTreeItem(element, this.label, 'Show differences between Solutions and Tanium Server', vscode.TreeItemCollapsibleState.Expanded, {
                light: path.join(this.resourcePath, 'light', 'folder.svg'),
                dark: path.join(this.resourcePath, 'dark', 'folder.svg')
            });

            if (this.solutionData) {
                serverSolutions.contextValue = 'serverSolutions';
            }

            roots.push(serverSolutions);

            roots.push(new TaniumSolutionTreeItem(element, 'Servers', 'Show differences between Tanium Servers', vscode.TreeItemCollapsibleState.Expanded, {
                light: path.join(this.resourcePath, 'light', 'folder.svg'),
                dark: path.join(this.resourcePath, 'dark', 'folder.svg')
            }));

            return Promise.resolve(roots);
        }
    }

}