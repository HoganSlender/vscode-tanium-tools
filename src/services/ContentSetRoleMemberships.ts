/* eslint-disable @typescript-eslint/naming-convention */
import * as commands from '../common/commands';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path = require('path');
import * as pug from 'pug';
import { OutputChannelLogging } from '../common/logging';

export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.analyzeContentSetRolePrivileges': (uri: vscode.Uri, uris: vscode.Uri[]) => {
            ContentSetRoleMemberships.analyzeContentSetRolePrivileges(uris[0], uris[1], context);
        },
    });
}

export class ContentSetRoleMemberships {
    static async analyzeContentSetRolePrivileges(left: vscode.Uri, right: vscode.Uri, context: vscode.ExtensionContext) {
        // TODO
    }
}
