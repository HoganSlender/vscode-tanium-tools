import { ExtensionContext } from 'vscode';
import * as contentSet from './services/ContentSet';
import * as serverServer from './services/ServerServer';
import * as serverServerPackages from './services/ServerServerPackages';
import * as serverServerContentSets from './services/ServerServerContentSets';
import * as serverServerContentSetPrivileges from './services/ServerServerContentSetPrivileges';
import * as serverServerContentSetRoles from './services/ServerServerContentSetRoles';
import * as serverServerContentSetRolePrivileges from './services/ServerServerContentSetRolePrivileges';
import * as serverServerContentSetRoleMemberships from './services/ServerServerContentSetRoleMemberships';
import * as serverServerUsers from './services/ServerServerUsers';
import * as serverServerUserGroups from './services/ServerServerUserGroups';
import * as signContentFile from './services/SignContentFile';
import * as sensor from './services/Sensor';
import * as packages from './services/Packages';
import * as contentSets from './services/ContentSets';
import * as contentSetPrivileges from './services/ContentSetPrivileges';
import * as contentSetRoles from './services/ContentSetRoles';
import * as contentSetRolePrivileges from './services/ContentSetRolePrivileges';
import { OutputChannelLogging } from './common/logging';
import * as users from './services/Users';
import * as userGroups from './services/UserGroups';
import * as contentSetRoleMemberships from './services/ContentSetRoleMemberships';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	OutputChannelLogging.initialize();

	contentSet.activate(context);
	serverServer.activate(context);
	serverServerPackages.activate(context);
	serverServerContentSets.activate(context);
	serverServerContentSetPrivileges.activate(context);
	serverServerContentSetRoles.activate(context);
	serverServerContentSetRolePrivileges.activate(context);
	serverServerContentSetRoleMemberships.activate(context);
	serverServerUsers.activate(context);
	serverServerUserGroups.activate(context);
	signContentFile.activate(context);
	sensor.activate(context);
	packages.activate(context);
	contentSets.activate(context);
	contentSetPrivileges.activate(context);
	contentSetRoles.activate(context);
	contentSetRolePrivileges.activate(context);
	users.activate(context);
	userGroups.activate(context);
	contentSetRoleMemberships.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
