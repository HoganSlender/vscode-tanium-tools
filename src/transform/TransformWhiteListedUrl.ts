import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformWhiteListedUrl extends TransformBase {
    static async transformCs(whiteListedUrl: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                if ('meta_data' in whiteListedUrl) {
                    if (whiteListedUrl['meta_data'] === '') {
                        this.deleteProperty(whiteListedUrl, 'meta_data');
                    } else {
                        whiteListedUrl['meta_data'] = await TransformMetaData.transformCs(whiteListedUrl['meta_data']);
                    }
                }

                return resolve(whiteListedUrl);

            } catch (err) {
                OutputChannelLogging.logError('TransformWhiteListedUrl.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    static async transform(whiteListedUrl: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                if ('metadata' in whiteListedUrl) {
                    whiteListedUrl['meta_data'] = await TransformMetaData.transform(whiteListedUrl['metadata']);
                }

                return resolve(whiteListedUrl);

            } catch (err) {
                OutputChannelLogging.logError('TransformWhiteListedUrl.transform', err);
                return reject();
            }
        });

        return p;
    }
}