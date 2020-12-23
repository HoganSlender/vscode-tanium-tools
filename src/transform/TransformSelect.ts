import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";

export class TransformSelect extends TransformBase {
    static transformCs(selectSpec: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                var result: any = {};

                result['sensor'] = {
                    name: selectSpec.sensor.name
                };

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSelect.transformCs', err);
                return reject();
            }
        });

        return p;
    }
    static transform(select: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                var result: any = {};

                result['sensor'] = {
                    name: select.sensor.name
                };

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSelect.transform', err);
                return reject();
            }
        });

        return p;
    }
}