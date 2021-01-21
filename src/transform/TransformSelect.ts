import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformSensor } from "./TransformSensor";

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
                var result: any = {
                    type: 'select'
                };

                result['sensor'] = {
                    name: select.sensor.name
                };

                if ('source' in select) {
                    this.transpondStringToIntegerNewName(select.source, result, 'hash', 'what_hash');
                } else {
                    this.transpondStringToIntegerNewName(select.sensor, result, 'hash', 'what_hash');
                }

                if ('filter' in select) {
                    this.processFilter(select.sensor, select.filter, result);
                }

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSelect.transform', err);
                return reject();
            }
        });

        return p;
    }

    static processFilter(sensor: any, filter: any, result: any) {
        if (filter.operator === 'HashMatch' && filter.value === '') {
            result.how_reg_ex = '';
            result.equal_flag = 0;
            result.not_flag = 0;
            result.greater_flag = 0;
            result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
        } else {
            if (filter.operator === "HashMatch") {
                result.how_hash = filter.value;
                result.equal_flag = 1;
                result.not_flag = 0;
                result.greater_flag = 0;
                result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
            } else if (filter.operator === "RegexMatch") {
                result.how_reg_ex = filter.value;
                result.equal_flag = 0;
                result.not_flag = 0;
                result.greater_flag = 0;
                result.result_type = 11;
            } else {
                if (filter.operator === "Less") {
                    result.equal_flag = 1;
                    result.not_flag = 1;
                    result.greater_flag = 1;
                    result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
                } else if (filter.operator === "Greater") {
                    result.equal_flag = 0;
                    result.not_flag = 0;
                    result.greater_flag = 1;
                    result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
                } else if (filter.operator === "LessEqual") {
                    result.equal_flag = 0;
                    result.not_flag = 1;
                    result.greater_flag = 1;
                    result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
                } else if (filter.operator === "GreaterEqual") {
                    result.equal_flag = 1;
                    result.not_flag = 0;
                    result.greater_flag = 1;
                    result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
                } else if (filter.operator === "Equal") {
                    result.equal_flag = 1;
                    result.not_flag = 0;
                    result.greater_flag = 0;
                    result.result_type = TransformSensor.soapValueTypeToResultType(sensor.value_type);
                }
                result.how_name = filter.value;
            }
        }

        result['aggregation'] = this.fromSOAPAggregation(filter['aggregation']);
        this.transpondBooleanToInteger(filter, result, 'all_times_flag');
        this.transpondBooleanToInteger(filter, result, 'all_values_flag');
        this.transpond(filter, result, 'delimiter');
        result['delimiter'] = (filter.delimiter.length === 0) ? 0 : filter.delimiter;
        this.transpond(filter, result, 'delimiter_index');
        this.transpondBooleanToInteger(sensor, result, 'ignore_case_flag');
        this.transpond(filter, result, 'max_age_seconds');
        this.transpondBooleanToInteger(filter, result, 'not_flag');
        result.start_time = (filter.start_time !== "2001-01-01T00:00:00Z") ? filter.start_time : "";
        result.end_time = (filter.end_time !== "2001-01-01T00:00:00Z") ? filter.end_time : "";
        // this.transpondBooleanToInteger(filter, result, 'utf8_flag');
    }

    static fromSOAPAggregation(aggregation: string): number {
        switch (aggregation) {
            case 'Sum': return 0;
            case 'Average': return 1;
            case 'Minimum': return 2;
            case 'Maximum': return 3;
            case 'Count': return 4;
            default:
                return 0;
        }
    }
}