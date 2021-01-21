/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSet extends TransformBase {
    public static transformCs(contentSet: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                this.deleteProperty(contentSet, 'disable_action_approval');
                this.deleteProperty(contentSet, 'is_namespace_default_repo');

                if ('meta_data' in contentSet) {
                    if (contentSet['meta_data'] === '') {
                        this.deleteProperty(contentSet, 'meta_data');
                    } else {
                        contentSet['meta_data'] = await TransformMetaData.transformCs(contentSet['meta_data']);
                    }
                }

                return resolve(contentSet);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSet.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    public static transform(contentSet: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                const result: any = {};

                // name
                this.transpond(contentSet, result, 'name');

                // description
                this.transpond(contentSet, result, 'description');

                this.transpond(contentSet, result, 'reserved_name');

                if ('metadata' in contentSet) {
                    result['meta_data'] = await TransformMetaData.transform(contentSet['metadata']);
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSet.transform', err);
                return reject();
            }
        });

        return p;
    }
}