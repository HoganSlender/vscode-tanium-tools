export class TransformMetadataItem {
    public static transform(metadata: any) {
        return {
            name: metadata.name,
            value: this.convertBoolean(metadata.value)
        };
    }

    static convertBoolean(input: string) {
        if (input === 'true') {
            return true;
        } else if (input === 'false') {
            return false;
        } else {
            return input;
        }
    }
}
