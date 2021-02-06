import { ExtensionContext } from 'vscode';

import { OutputChannelLogging } from './common/logging';
import * as contentSet from './services/ContentSet';
import * as contentSetPrivileges from './services/ContentSetPrivileges';
import * as contentSetRoleMemberships from './services/ContentSetRoleMemberships';
import * as contentSetRolePrivileges from './services/ContentSetRolePrivileges';
import * as contentSetRoles from './services/ContentSetRoles';
import * as contentSets from './services/ContentSets';
import * as contentSetUserGroupRoleMemberships from './services/ContentSetUserGroupRoleMemberships';
import * as dashboardGroups from './services/DashboardGroups';
import * as dashboards from './services/Dashboards';
import * as groups from './services/Groups';
import * as packages from './services/Packages';
import * as SavedActions from './services/SavedActions';
import * as savedQuestions from './services/SavedQuestions';
import * as sensor from './services/Sensor';
import * as sensors from './services/Sensors';
//import * as serverServer from './services/ServerServer';
import * as serverServerContentSetPrivileges from './services/ServerServerContentSetPrivileges';
import * as serverServerContentSetRoleMemberships from './services/ServerServerContentSetRoleMemberships';
import * as serverServerContentSetRolePrivileges from './services/ServerServerContentSetRolePrivileges';
import * as serverServerContentSetRoles from './services/ServerServerContentSetRoles';
import * as serverServerContentSets from './services/ServerServerContentSets';
import * as serverServerContentSetUserGroupRoleMemberships from './services/ServerServerContentSetUserGroupRoleMemberships';
import * as serverServerDashboardGroups from './services/ServerServerDashboardGroups';
import * as serverServerDashboards from './services/ServerServerDashboards';
import * as serverServerGroups from './services/ServerServerGroups';
import * as serverServerPackages from './services/ServerServerPackages';
import * as serverServerSavedActions from './services/ServerServerSavedActions';
import * as serverServerSavedQuestions from './services/ServerServerSavedQuestions';
import * as serverServerSensors from './services/ServerServerSensors';
import * as serverServerUserGroups from './services/ServerServerUserGroups';
import * as serverServerUsers from './services/ServerServerUsers';
import * as signContentFile from './services/SignContentFile';
import * as solutions from './services/Solutions';
import * as userGroups from './services/UserGroups';
import * as users from './services/Users';
import * as taniumDiffProvider from './trees/TaniumDiffProvider';
import * as taniumNodeProvider from './trees/TaniumSolutionNodeProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	OutputChannelLogging.initialize();

	contentSet.activate(context);
	contentSetPrivileges.activate(context);
	contentSetRoleMemberships.activate(context);
	contentSetRolePrivileges.activate(context);
	contentSetRoles.activate(context);
	contentSets.activate(context);
	contentSetUserGroupRoleMemberships.activate(context);
	dashboardGroups.activate(context);
	dashboards.activate(context);
	groups.activate(context);
	packages.activate(context);
	SavedActions.activate(context);
	savedQuestions.activate(context);
	sensor.activate(context);
	sensors.activate(context);
	//serverServer.activate(context);
	serverServerContentSetPrivileges.activate(context);
	serverServerContentSetRoleMemberships.activate(context);
	serverServerContentSetRolePrivileges.activate(context);
	serverServerContentSetRoles.activate(context);
	serverServerContentSets.activate(context);
	serverServerContentSetUserGroupRoleMemberships.activate(context);
	serverServerDashboardGroups.activate(context);
	serverServerDashboards.activate(context);
	serverServerGroups.activate(context);
	serverServerPackages.activate(context);
	serverServerSavedActions.activate(context);
	serverServerSavedQuestions.activate(context);
	serverServerSensors.activate(context);
	serverServerUserGroups.activate(context);
	serverServerUsers.activate(context);
	signContentFile.activate(context);
	solutions.activate(context);
	taniumDiffProvider.activate(context);
	taniumNodeProvider.activate(context);
	userGroups.activate(context);
	users.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
