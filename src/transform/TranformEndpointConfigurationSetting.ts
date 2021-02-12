import { TransformBase } from "./TransformBase";

export class TransformEndpointConfigurationSetting extends TransformBase {
    public static transform(settingName: string, endpointConfigurationSetting: any) {
        const retval = {
            name: settingName
        };

        if ('value' in endpointConfigurationSetting) {
            this.transpond(endpointConfigurationSetting, retval, 'value');
        } else {
            this.transpondNewName(endpointConfigurationSetting, retval, 'default_value', 'value');
        }

        return retval;
    }
}