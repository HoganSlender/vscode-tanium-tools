export class TransformContentSetRolePrivilege {
    public static transformCs(contentSetRolePrivilege: any) {
        const result: any = {};

        result['content_set'] = {
            name: contentSetRolePrivilege.content_set.name
        };

        result['content_set_role'] = {
            name: contentSetRolePrivilege.content_set_role.name
        };

        result['content_set_privilege'] = {
            name: contentSetRolePrivilege.content_set_privilege.name
        };

        return result;
    }

    public static transform(contentSetRolePrivilege: any) {
        return contentSetRolePrivilege;
    }
}