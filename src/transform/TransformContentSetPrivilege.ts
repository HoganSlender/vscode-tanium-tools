import { TransformBase } from "./TransformBase";

export class TransformContentSetPrivilege extends TransformBase {
    public static transformCs(contentSetPrivilege: any) {
        delete contentSetPrivilege.taas_internal_flag;

        if (contentSetPrivilege.meta_data === '') {
            delete contentSetPrivilege.meta_data;
        }

        return contentSetPrivilege;
    }

    public static transform(contentSetPrivilege: any) {
        var result = {};

        this.transpond(contentSetPrivilege, result, 'name');
        this.transpond(contentSetPrivilege, result, 'reserved_name');
        this.transpond(contentSetPrivilege, result, 'privilege_type');
        this.transpond(contentSetPrivilege, result, 'privilege_module');

        return result;
    }
}