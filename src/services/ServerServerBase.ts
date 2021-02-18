import * as vscode from 'vscode';

import { OutputChannelLogging } from '../common/logging';
import { Session } from '../common/session';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

export interface TaniumCredentials {
    fqdn: FqdnSetting,
    username: string,
    password: string,
}

export class ServerServerBase {
    static invalidWorkspaceFolders(): boolean {
        if (!vscode.workspace.workspaceFolders) {
            OutputChannelLogging.showClear();
            OutputChannelLogging.log('You have not yet opened a folder. A workspace folder is required.');
            return true;
        }

        return false;
    }

    static invalidCredentials(allowSelfSignedCerts: boolean, httpTimeout: number, input: TaniumCredentials[]): Promise<boolean> {
        const p = new Promise<boolean>(async (resolve) => {
            var currentCreds: TaniumCredentials = {
                fqdn: {
                    fqdn: '',
                    label: ''
                },
                username: '',
                password: ''
            };

            try {
                for (var i = 0; i < input.length; i++) {
                    currentCreds = input[i];
                    await Session.getSession(allowSelfSignedCerts, httpTimeout, currentCreds.fqdn, currentCreds.username, currentCreds.password);
                }

                return resolve(false);

            } catch (err) {
                OutputChannelLogging.logError(`invalid credentials for ${currentCreds.fqdn.label}`, err)
                return resolve(true);
            }
        });

        return p;
    }
}