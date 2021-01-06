import { TransformBase } from "./TransformBase";

export class TransformDashboardGroup extends TransformBase {
    static transformCs(dashboardGroup: any) {
        var result: any = {};

        this.transpond(dashboardGroup, result, 'name');
        this.transpond(dashboardGroup, result, 'public_flag');
        this.transpond(dashboardGroup, result, 'editable_flag');
        this.transpond(dashboardGroup, result, 'text');

        this.transpondNewName(dashboardGroup, result, 'icon_0', 'icon');

        var target = dashboardGroup['dashboards']['dashboard'];
        if (Array.isArray(target)) {
            // multiple
            var dashboards: any[] = [];
            target.forEach(dashboard => dashboards.push({
                name: dashboard.name
            }));
            result['dashboards'] = {
                dashboard: dashboards
            };
        } else {
            // single
            result['dashboards'] = {
                dashboard: {
                    name: dashboardGroup['dashboards']['dashboard']['name']
                }
            };
        }

        return result;
    }

    static transform(dashboardGroup: any) {
        var result: any = {};

        this.transpond(dashboardGroup, result, 'name');
        this.transpondBooleanToInteger(dashboardGroup, result, 'public_flag');
        this.transpondBooleanToInteger(dashboardGroup, result, 'editable_flag');
        this.transpond(dashboardGroup, result, 'text');
        this.transpond(dashboardGroup, result, 'icon');

        var target = dashboardGroup['dashboards'];
        if (target.length === 1) {
            // single
            result['dashboards'] = {
                dashboard: {
                    name: target[0].name
                }
            };
        } else {
            // multiple
            var dashboards: any[] = [];
            target.forEach((item: any) => dashboards.push(item));
            result['dashboards'] = {
                dashboard: dashboards
            };
        }

        return result;
    }
}