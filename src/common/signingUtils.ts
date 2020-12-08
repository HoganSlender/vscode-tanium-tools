/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { OutputChannelLogging } from '../common/logging';
import { SignContentFile } from '../services/SignContentFile';
import { PostTextPlainData, RestClient } from './restClient';

import path = require('path');
import { SigningKey } from '../types/signingKey';

export interface ImportStatusData {
    id: number,
    start_time: string,
    end_time: string,
    result: string,
    exception?: string,
    success: boolean,
}

export interface SignedContentData {
    content: string,
    path: string
}

export class SigningUtils {
    static async retrieveSignedContent(
        outputJson: any,
        signingKey: SigningKey,
    ) {
        const p = new Promise<SignedContentData>(async (resolve, reject) => {
            try {
                // save file in temp
                const tempDir = os.tmpdir();
                const tempPath = path.join(tempDir, uuidv4());
                fs.writeFileSync(tempPath, `${JSON.stringify(outputJson)}\r\n`, 'utf-8');

                // sign json
                await SignContentFile.signContent(signingKey.keyUtilityPath, signingKey.privateKeyFilePath, tempPath);

                // import into Tanium server
                const signedContent = fs.readFileSync(tempPath, {
                    encoding: 'utf-8'
                });

                resolve({
                    content: signedContent,
                    path: tempPath
                });
            } catch (err) {
                OutputChannelLogging.logError(`error signing content`, err);
                reject();
            }
        });

        return p;
    }

    static postSignedContent(
        destFqdn: string,
        destSession: string,
        signedContent: string,
        allowSelfSignedCerts: boolean,
        httpTimeout: number
    ) {
        const p = new Promise<ImportStatusData>(async (resolve, reject) => {
            var hostname: string = destFqdn;
            var port: number = 443;

            if (destFqdn.includes(':')) {
                const items = destFqdn.split(':');
                hostname = items[0];
                port = Number(items[1]);
            }

            // analyze only 
            var headers: any = {};
            headers['session'] = destSession;
            headers['Content-Type'] = 'text/plain';
            headers['Content-Length'] = signedContent.length;

            try {
                const options = {
                    hostname: hostname,
                    port: port,
                    path: '/api/v2/import?import_analyze_conflicts_only=1',
                    method: 'POST',
                    headers: headers,
                    rejectUnauthorized: !allowSelfSignedCerts,
                    timeout: httpTimeout
                };

                const analyzeRes = await RestClient.postTextPlain(signedContent, options);

                const conflictData: any = analyzeRes.data.data.object_list.import_conflict_details;

                const conflictOptions: any = {
                    import_existing_ignore_content_set: 1,
                    default_import_conflict_option: 3,
                    import_conflict_options_by_type_and_name: {},
                };

                // iterate though conflict details and generate options
                const target = conflictOptions.import_conflict_options_by_type_and_name;
                conflictData.forEach((conflict: any) => {
                    switch (conflict.type) {
                        case 'group':
                            // check for changes to the group only
                            if (!conflict.is_new) {
                                if (!target.hasOwnProperty(conflict.type)) {
                                    target[conflict.type] = {};
                                }
    
                                if (conflict.diff.includes('flag')) {
                                    // need to include
                                    target.group[conflict.name] = 1;
                                } else {
                                    // exclude
                                    target.group[conflict.name] = 3;
                                }
                            }
                            break;

                        default:
                            break;
                    }
                });

                // import
                headers.tanium_options = JSON.stringify(conflictOptions);
                headers.Prefer = 'respond-async';

                options.path = '/api/v2/import';

                const importRes = await RestClient.postTextPlain(signedContent, options);
                const importStatusId = importRes.data.data.id;

                // retrieve status
                var isRunning = true;
                while (isRunning) {
                    // get status
                    const body = await RestClient.get(`https://${destFqdn}/api/v2/import/${importStatusId}`, {
                        headers: {
                            session: destSession,
                        },
                        responseType: 'json',
                    }, allowSelfSignedCerts, httpTimeout);

                    // check to see if complete
                    isRunning = (body.data.end_time === undefined);

                    // if complete, resolve the object
                    if (!isRunning) {
                        resolve(body.data);
                    }
                }
            } catch (err) {
                OutputChannelLogging.logError(`error in postSignedContent`, err);
                reject();
            }
        });

        return p;
    }
}