/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformMetadataItem } from "./TransformMetadataItem";

export class TransformMetaData extends TransformBase {
    static transformCs(item: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                var target = item['meta_data_item'];
                if (Array.isArray(target)) {
                    const metaDataItems: any[] = [];
                    for (var i = 0; i < target.length; i++) {
                        const metaDataItem = target[i];
                        metaDataItems.push(TransformMetadataItem.transform(metaDataItem));
                    };
                    item['meta_data_item'] = metaDataItems;
                    item.meta_data_item.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);
                } else {
                    item['meta_data_item'] = TransformMetadataItem.transform(item['meta_data_item']);
                }

                return resolve(item);

            } catch (err) {
                OutputChannelLogging.logError('TransformMetaData.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    static transform(item: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                if (item.length === 1) {
                    item = {
                        meta_data_item: TransformMetadataItem.transform(item[0])
                    };
                } else {
                    const metaDataItems: any[] = [];

                    for(var i = 0; i < item.length; i++) {
                        const metaDataItem = item[i];
                        metaDataItems.push(TransformMetadataItem.transform(metaDataItem));
                    };

                    metaDataItems.sort((a: any, b: any) => (a.name > b.name) ? 1 : -1);

                    item = {
                        meta_data_item: metaDataItems
                    };
                }

                return resolve(item);

            } catch (err) {
                OutputChannelLogging.logError('TransformMetaData.transform', err);
                return reject();
            }
        });

        return p;
    }
}