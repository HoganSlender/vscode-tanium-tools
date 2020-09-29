import * as fs from 'fs';
import https = require('https');

const got = require('got');
const { promisify } = require('util');
const stream = require('stream');

export class RestClient {
    static postTextPlain(data: string, options: any) {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            try {
                const req = https.request(options, res => {
                    console.log(`statusCode: ${res.statusCode}`);

                    res.on('data', d => {
                        return resolve(d);
                    });
                });

                req.on('error', err => {
                    return reject(err);
                });

                req.write(data);
                req.end();
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static post(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number) {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.post(url, options);

                return resolve(body);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static get(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number) {
        const p: Promise<any> = new Promise(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.get(url, options);

                return resolve(body);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static downloadFile(url: string, filePath: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number) {
        const p = new Promise(async (resolve, reject) => {
            const pipeline = promisify(stream.pipeline);
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                await pipeline(
                    got.stream(url, options),
                    fs.createWriteStream(filePath)
                );
            } catch (err) {
                return reject(err);
            }

            return resolve();
        });

        return p;
    }

    static _wrapOption(allow: boolean, httpTimeout: number, options: any) {
        if (allow) {
            options['https'] = {
                rejectUnauthorized: !allow
            };
        }

        options.timeout = httpTimeout;

        return options;
    }
}
