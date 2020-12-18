import { TransformMetadataItem } from "./transform-metadata-item";
import { TransformBase } from "./TransformBase";

export class TransformContentSetRole extends TransformBase {
    public static transformCs(contentSetRole: any) {
        // kill taas_internal_flag
        delete contentSetRole.taas_internal_flag;

        if (contentSetRole.meta_data === '') {
            delete contentSetRole.meta_data;
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

        return result;
    }
}