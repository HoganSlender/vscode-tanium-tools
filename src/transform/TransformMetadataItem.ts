import { isArrayLike } from "lodash";
import { TransformBase } from "./TransformBase";

export class TransformMetadataItem extends TransformBase {
    public static transform(metadata: any) {
        const newValue = this.convertWhitespace(metadata.value);

        return {
            name: metadata.name,
            value: this.convertBoolean(newValue)
        };
    }

    static convertBoolean(input: any) {
        if (Array.isArray(input)) {
            return input;
        }
        
        if (input === 'true') {
            return true;
        } else if (input === 'false') {
            return false;
        } else {
            return input;
        }
    }
}
