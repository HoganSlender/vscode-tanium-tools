/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { OutputChannelLogging } from '../common/logging';
import { SignContentFile } from '../services/SignContentFile';
import { RestClient } from './restClient';

import path = require('path');
import { SigningKey } from '../types/signingKey';

export class SigningUtils {
    static async retrieveSignedContent(
        outputJson: any,
        signingKey: SigningKey,
    ) {
        const p = new Promise<any>(async (resolve, reject) => {
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
        session: string,
        signedContent: string,
        allowSelfSignedCerts: boolean,
        httpTimeout: number
    ) {
        const p = new Promise<any>(async (resolve, reject) => {
            var hostname: string = destFqdn;
            var port: number = 443;

            if (destFqdn.includes(':')) {
                const items = destFqdn.split(':');
                hostname = items[0];
                port = Number(items[1]);
            }
            
            try {
                const options = {
                    hostname: hostname,
                    port: port,
                    path: '/api/v2/import',
                    method: 'POST',
                    headers: {
                        session: session,
                        'Content-Type': 'text/plain',
                        'Content-Length': signedContent.length
                    },
                    rejectUnauthorized: !allowSelfSignedCerts,
                    timeout: httpTimeout
                };

                const res = await RestClient.postTextPlain(signedContent, options);
                resolve(res);
            } catch (err) {
                reject();
            }
        });

        return p;
    }
}