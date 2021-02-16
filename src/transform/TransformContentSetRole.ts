import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSetRole extends TransformBase {
    public static transformCs(contentSetRole: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                // kill taas_internal_flag
                delete contentSetRole.taas_internal_flag;

                if ('meta_data' in contentSetRole) {
                    if (contentSetRole['meta_data'] === '') {
                        this.deleteProperty(contentSetRole, 'meta_data');
                    } else {
                        contentSetRole['meta_data'] = await TransformMetaData.transformCs(contentSetRole['meta_data']);
                    }
                }

                return resolve(contentSetRole);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSetRole.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    public static transform(contentSetRole: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(contentSetRole, result, 'name');
                
                if ('description' in contentSetRole && contentSetRole['description'].length === 0) {
                    this.deleteProperty(contentSetRole, 'description');
                } else {
                    this.transpond(contentSetRole, result, 'description');
                }
                
                this.transpond(contentSetRole, result, 'reserved_name');
                this.transpondStringToInteger(contentSetRole, result, 'deny_flag');
                this.transpondStringToInteger(contentSetRole, result, 'all_content_sets_flag');
                this.transpond(contentSetRole, result, 'category');

                if ('metadata' in contentSetRole) {
                    result['meta_data'] = await TransformMetaData.transform(contentSetRole['metadata']);
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSetRole.transform', err);
                return reject();
            }
        });

        return p;
    }
}