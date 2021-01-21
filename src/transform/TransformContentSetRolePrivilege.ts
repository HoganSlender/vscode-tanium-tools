import { OutputChannelLogging } from "../common/logging";

export class TransformContentSetRolePrivilege {
    public static transformCs(contentSetRolePrivilege: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
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

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TransformContentSetRolePrivilege.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    public static transform(contentSetRolePrivilege: any) {
        const p = new Promise<any>((resolve) => {
            return resolve(contentSetRolePrivilege);
        });

        return p;
    }
}