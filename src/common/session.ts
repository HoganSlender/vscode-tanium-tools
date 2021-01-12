import { FqdnSetting } from "../parameter-collection/fqdnSetting";
import { RestClient } from "./restClient";

export class Session {

    static getSession(allowSelfSignedCerts: boolean, httpTimeout: number, fqdn: FqdnSetting, username: string, password: string): Promise<string> {
        const p: Promise<string> = new Promise<string>(async (resolve, reject) => {
            try {
                const destRestBase = `https://${fqdn.fqdn}/api/v2`;
                const options = {
                    json: {
                        username: username,
                        password: password,
                    },
                    responseType: 'json',
                };

                const body = await RestClient.post(`${destRestBase}/session/login`, options, allowSelfSignedCerts, httpTimeout);

                return resolve(body.data.session);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }
}