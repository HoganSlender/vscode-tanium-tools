/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { RestClient } from "../common/restClient";
import { FqdnSetting } from "../parameter-collection/fqdnSetting";

export class WhiteListedUrls {
    static generateWhiteListedUrlMap(
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        session: string,
        fqdn: FqdnSetting
    ) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                const result: any = {};

                const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/white_listed_urls`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                body.data.forEach((whiteListedUrl: any) => {
                    result[whiteListedUrl.url_regex] = {
                        url: whiteListedUrl.url_regex,
                        download_seconds: whiteListedUrl.download_seconds,
                    };
                });

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError(`error in generateWhiteListedUrlMap`, err);
                return reject();
            }
        });

        return p;
    }
}