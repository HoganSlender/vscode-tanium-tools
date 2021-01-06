/* eslint-disable @typescript-eslint/naming-convention */
import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformContentSet extends TransformBase {
    public static transformCs(contentSet: any) {
        this.deleteProperty(contentSet, 'disable_action_approval');
        this.deleteProperty(contentSet, 'is_namespace_default_repo');

        if ('meta_data' in contentSet) {
            if (contentSet['meta_data'] === '') {
                this.deleteProperty(contentSet, 'meta_data');
            } else {
                TransformMetaData.transformCs(contentSet['meta_data']);
            }
        }

        return contentSet;
    }
    
    public static transform(contentSet: any) {
        const result: any = {};

        // name
        this.transpond(contentSet, result, 'name');

        // description
        this.transpond(contentSet, result, 'description');

        this.transpond(contentSet, result, 'reserved_name');

        if ('metadata' in contentSet) {
            TransformMetaData.transform(contentSet['metadata']);
            this.transpond(contentSet, result, 'metadata');
        }

        return result;
    }
}