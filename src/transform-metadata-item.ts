export class TransformMetadataItem {
    public static transform(metadata: any) {
        return {
            'name': metadata.name,
            'value': metadata.value
        };
    }
}
