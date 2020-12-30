import { TransformBase } from "./TransformBase";

export class TransformWhiteListedUrl extends TransformBase {
    static transformCs(whiteListedUrl: any) {
        // remove meta_data
        delete whiteListedUrl.meta_data;
        
        return whiteListedUrl;
    }

    static transform(whiteListedUrl: any) {
        return whiteListedUrl;
    }
}