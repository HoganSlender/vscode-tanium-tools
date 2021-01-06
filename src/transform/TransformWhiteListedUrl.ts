import { TransformBase } from "./TransformBase";
import { TransformMetaData } from "./TransformMetaData";

export class TransformWhiteListedUrl extends TransformBase {
    static transformCs(whiteListedUrl: any) {
        if ('meta_data' in whiteListedUrl) {
            if (whiteListedUrl['meta_data'] === '') {
                this.deleteProperty(whiteListedUrl, 'meta_data');
            } else {
                TransformMetaData.transformCs(whiteListedUrl['meta_data']);
            }
        }
        
        return whiteListedUrl;
    }

    static transform(whiteListedUrl: any) {

        if ('metadata' in whiteListedUrl) {
            TransformMetaData.transform(whiteListedUrl['metadata']);
        }

        return whiteListedUrl;
    }
}