/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformSensor } from "./TransformSensor";
import { TransformBase } from "./TransformBase";

export class TransformGroup extends TransformBase {
    static transform(group: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};
                var sentence: any = {};

                this.transpondBooleanToInteger(group, sentence, 'not_flag');
                this.transpondBooleanToInteger(group, sentence, 'and_flag');

                if ('filters' in group) {
                    if (group.filters.length === 0) {
                        sentence['filter_specs'] = '';
                    } else {
                        var filters: any[] = [];

                        for (var i = 0; i < group.filters.length; i++) {
                            const filter = group.filters[i];
                            filters.push(await TransformGroup.transformFilter(filter));
                        }

                        if (filters.length === 1) {
                            sentence['filter_specs'] = {
                                filter_spec: filters[0]
                            };
                        } else {
                            sentence['filter_specs'] = {
                                filter_spec: filters
                            };
                        }
                    }
                } else {
                    sentence['filter_specs'] = '';
                }
                result['sentence'] = sentence;

                if ('sub_groups' in group) {
                    var newItems: any[] = [];
                    for (var i = 0; i < group.sub_groups.length; i++) {
                        const subGroup = group.sub_groups[i];
                        newItems.push(await TransformGroup.transform(subGroup));
                    }

                    if (newItems.length > 1) {
                        result['group'] = newItems;
                    } else {
                        result['group'] = newItems[0];
                    }
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformGroup.transform', err);
                return reject();
            }
        });

        return p;
    }

    static transformFilter(filter: any): any {
        const p = new Promise<any>((resolve, reject) => {
            try {
                var result: any = {};
                const filterValueType = TransformSensor.soapValueTypeToResultType(filter.value_type);

                if (filterValueType === 0) {
                    this.transpondStringToIntegerNewName(filter, result, 'value', 'how_hash');
                }
                result['type'] = 'filter';
                result['what_hash'] = filter.sensor.hash;
                if (filterValueType !== 0) {
                    result['how_reg_ex'] = filter.value;
                } else {
                    result['how_reg_ex'] = '';
                }

                this.transpond(filter, result, 'max_age_seconds');
                this.transpond(filter, result, 'not_flag');
                this.transpond(filter, result, 'max_age_seconds');

                var oper = this.transformOperator(filter.not_flag, filter.operator);
                result['not_flag'] = oper['not_flag'];
                result['greater_flag'] = oper['greater_flag'];
                result['equal_flag'] = oper['equal_flag'];

                this.transpondBooleanToInteger(filter, result, 'ignore_case_flag');
                this.transpondBooleanToInteger(filter, result, 'substring_flag');
                this.transpondBooleanToInteger(filter, result, 'all_values_flag');

                result['all_times_flag'] = 0;
                result['utf8_flag'] = 0;

                result['result_type'] = filter.operator === 'RegexMatch' ? 11 : TransformSensor.soapValueTypeToResultType(filter.value_type);

                if ('aggregation' in filter) {
                    result['aggregation'] = this.fromSOAPAggregation(filter.aggregation);
                } else {
                    result['aggregation'] = 0;
                }

                this.transpond(filter, result, 'substring_start');
                this.transpond(filter, result, 'substring_length');

                result['end_time'] = '';

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformGroup.transformFilter', err);
                return reject();
            }
        });

        return p;
    }

    static fromSOAPAggregation(aggregation: any) {
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

    public static transformOperator(orig_not_flag: any, val: any) {
        var result: any = {};
        // operator also handles the not_flag
        var not_flag = (Number(orig_not_flag) === 0) ? false : true;
        if (val === "HashMatch") {
            result.equal_flag = 1;
            result.not_flag = not_flag ? 1 : 0;
            result.greater_flag = 0;
        } else if (val === "RegexMatch") {
            result.equal_flag = 0;
            result.not_flag = not_flag ? 1 : 0;
            result.greater_flag = 0;
        } else if ((val === "Less" && !not_flag) || (val === "GreaterEqual" && not_flag)) {
            result.equal_flag = 1;
            result.greater_flag = 1;
            result.not_flag = 1;
        } else if ((val === "Greater" && !not_flag) || (val === "LessEqual" && not_flag)) {
            result.equal_flag = 0;
            result.greater_flag = 1;
            result.not_flag = 0;
        } else if ((val === "LessEqual" && !not_flag) || (val === "Greater" && not_flag)) {
            result.equal_flag = 0;
            result.greater_flag = 1;
            result.not_flag = 1;
        } else if ((val === "GreaterEqual" && !not_flag) || (val === "Less" && not_flag)) {
            result.equal_flag = 1;
            result.greater_flag = 1;
            result.not_flag = 0;
        } else if (val === "Equal") {
            result.equal_flag = 1;
            result.greater_flag = 0;
            result.not_flag = not_flag ? 1 : 0;
        }

        return result;
    }
}