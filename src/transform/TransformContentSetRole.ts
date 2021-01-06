import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSetRole extends TransformBase {
    public static transformCs(contentSetRole: any) {
        // kill taas_internal_flag
        delete contentSetRole.taas_internal_flag;

        if ('meta_data' in contentSetRole) {
            if (contentSetRole['meta_data'] === '') {
                this.deleteProperty(contentSetRole, 'meta_data');
            } else {
                TransformMetaData.transformCs(contentSetRole['meta_data']);
            }
        }

        return contentSetRole;
    }

    public static transform(contentSetRole: any) {
        var result: any = {};

        this.transpond(contentSetRole, result, 'name');
        this.transpond(contentSetRole, result, 'description');
        this.transpond(contentSetRole, result, 'reserved_name');
        this.transpondStringToInteger(contentSetRole, result, 'deny_flag');
        this.transpondStringToInteger(contentSetRole, result, 'all_content_sets_flag');
        this.transpond(contentSetRole, result, 'category');

        if ('metadata' in contentSetRole) {
            TransformMetaData.transform(contentSetRole['metadata']);
            this.transpond(contentSetRole, result, 'metadata');
        }

        return result;
    }
}