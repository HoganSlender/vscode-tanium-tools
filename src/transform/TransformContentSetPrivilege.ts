import { OutgoingMessage } from "http";
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSetPrivilege extends TransformBase {
    public static transformCs(contentSetPrivilege: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                delete contentSetPrivilege.taas_internal_flag;

                if ('meta_data' in contentSetPrivilege) {
                    if (contentSetPrivilege['meta_data'] === '') {
                        this.deleteProperty(contentSetPrivilege, 'meta_data');
                    } else {
                        contentSetPrivilege['meta_data'] = await TransformMetaData.transformCs(contentSetPrivilege['meta_data']);
                    }
                }

                return resolve(contentSetPrivilege);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSetPrivilege.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    public static transform(contentSetPrivilege: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(contentSetPrivilege, result, 'name');
                this.transpond(contentSetPrivilege, result, 'reserved_name');
                this.transpond(contentSetPrivilege, result, 'privilege_type');
                this.transpond(contentSetPrivilege, result, 'privilege_module');

                if ('metadata' in contentSetPrivilege) {
                    result['meta_data'] = await TransformMetaData.transform(contentSetPrivilege['metadata']);
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSetPrivilege.transform', err);
                return reject();
            }
        });

        return p;
    }
}