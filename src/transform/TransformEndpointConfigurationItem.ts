import { TransformBase } from "./TransformBase";

export class TransformEndpointConfigurationItem extends TransformBase {
    public static transform(endpointConfigurationItem: any) {
        this.deleteProperty(endpointConfigurationItem, 'id');
        this.deleteProperty(endpointConfigurationItem, 'content_set_id');
        
        return endpointConfigurationItem;
    }
}