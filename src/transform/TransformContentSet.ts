/* eslint-disable @typescript-eslint/naming-convention */
import { TransformMetadataItem } from "./transform-metadata-item";
import { TransformBase } from "./TransformBase";

export class TransformContentSet extends TransformBase {
    public static transformCs(contentSet: any) {
        delete contentSet.disable_action_approval;

        // order metadata by name
        if (contentSet.meta_data) {
            contentSet.meta_data.meta_data_item.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);
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
            const metadata: any[] = [];
            const val = contentSet['metadata'];
            for (var i = 0; val && i < val.length; i++) {
                metadata.push(TransformMetadataItem.transform(val[i]));
            }

            metadata.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);

            result['meta_data'] = {
                meta_data_item: metadata
            };
            delete result['metadata'];
        }

        return result;
    }
}