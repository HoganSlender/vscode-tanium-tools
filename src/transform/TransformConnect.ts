import { TransformBase } from "./TransformBase";

export class TransformConnect extends TransformBase {
    static transformConnection(connectionExport: any): any {
        return connectionExport;
    }
    public static transformSettings(settings: any) {
        this.deleteProperty(settings, 'id');
        this.deleteProperty(settings, 'createdAt');
        this.deleteProperty(settings, 'updatedAt');

        return settings;
    }
}