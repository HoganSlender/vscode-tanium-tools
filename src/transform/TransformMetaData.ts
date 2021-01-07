import { TransformBase } from "./TransformBase";
import { TransformMetadataItem } from "./TransformMetadataItem";

export class TransformMetaData extends TransformBase {
    static transformCs(item: any) {
        if (Array.isArray(item['meta_data_item'])) {
            const metaDataItems: any[] = [];
            item['meta_data_item'].forEach(metaDataItem => {
                metaDataItems.push(TransformMetadataItem.transform(metaDataItem));
            });
            item['meta_data_item'] = metaDataItems;
            item.meta_data_item.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);
        } else {
            item['meta_data_item'] = TransformMetadataItem.transform(item['meta_data_item']);
        }
    }

    static transform(item: any) {
        if (item.length === 1) {
            item = TransformMetadataItem.transform(item[0]);
        } else {
            const metaDataItems: any[] = [];

            item.forEach((metaDataItem: any) => {
                metaDataItems.push(TransformMetadataItem.transform(metaDataItem));
            });

            metaDataItems.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);

            item = metaDataItems;
        }
    }
}