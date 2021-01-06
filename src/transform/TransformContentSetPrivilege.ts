import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSetPrivilege extends TransformBase {
    public static transformCs(contentSetPrivilege: any) {
        delete contentSetPrivilege.taas_internal_flag;

        if ('meta_data' in contentSetPrivilege) {
            if (contentSetPrivilege['meta_data'] === '') {
                this.deleteProperty(contentSetPrivilege, 'meta_data');
            } else {
                TransformMetaData.transformCs(contentSetPrivilege['meta_data']);
            }
        }

        return contentSetPrivilege;
    }

    public static transform(contentSetPrivilege: any) {
        var result = {};

        this.transpond(contentSetPrivilege, result, 'name');
        this.transpond(contentSetPrivilege, result, 'reserved_name');
        this.transpond(contentSetPrivilege, result, 'privilege_type');
        this.transpond(contentSetPrivilege, result, 'privilege_module');

        if ('metadata' in contentSetPrivilege) {
            TransformMetaData.transform(contentSetPrivilege['metadata']);
            this.transpond(contentSetPrivilege, result, 'metadata');
        }

        return result;
    }
}