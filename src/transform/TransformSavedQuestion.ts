/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformQuestion } from "./TransformQuestion";
import { TransformSelect } from "./TransformSelect";

export class TransformSavedQuestion extends TransformBase {
    static transformCs(savedQuestion: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(savedQuestion, result, 'name');
                this.transpond(savedQuestion, result, 'public_flag');
                this.transpond(savedQuestion, result, 'issue_seconds');
                this.transpond(savedQuestion, result, 'public_flag');
                this.transpond(savedQuestion, result, 'issue_seconds_never_flag');
                this.transpond(savedQuestion, result, 'expire_seconds');
                this.transpond(savedQuestion, result, 'row_count_flag');
                this.transpond(savedQuestion, result, 'disabled_flag');
                this.transpond(savedQuestion, result, 'hidden_flag');
                this.transpond(savedQuestion, result, 'keep_seconds');

                if ('sentence' in savedQuestion) {
                    result['question'] = this.processSentence(savedQuestion['sentence']);
                }

                if ('question' in savedQuestion) {
                    result['question'] = this.processSentence(savedQuestion['question'], true);
                }

                if ('packages' in savedQuestion) {
                    var target = savedQuestion.packages.tanium_package;
                    if (Array.isArray(target)) {
                        // process packages
                        const items: any[] = [];
                        target.forEach((pkg: any) => {
                            items.push({
                                tanium_package: {
                                    name: pkg.name
                                }
                            });
                        });

                        result['packages'] = items;
                    } else {
                        if (target === undefined) {
                            result['packages'] = '';
                        } else {
                            result['packages'] = {
                                tanium_package: {
                                    name: target.name
                                }
                            };
                        }
                    }
                }

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError(`error in TransformSavedQuestion.transformCs: saved question name: ${savedQuestion.name}`, err);
                return reject();
            }
        });

        return p;
    }

    static processSentence(sentence: any, questionFlag: boolean = false): any {
        // process each select_spec
        var result: any = {};

        // process selects
        var target = sentence.select_specs.select_spec;

        if (Array.isArray(target)) {
            // multiple selects
            const items: any[] = [];

            target.forEach(select => {
                if (('how_hash' in select && select.how_hash !== 0) || ('what_hash' in select && select.what_hash !== 0) || ('how_reg_ex' in select && select.how_reg_ex !== '')) {
                    //if (select.start_time.startsWith('1900-01-01')) {
                    // need to process
                    items.push(this.processSelect(select, questionFlag));
                }
            });

            if (items.length === 1) {
                // single
                result['select_specs'] = {
                    select_spec: items[0]
                };
            } else {
                // multiple
                result['select_specs'] = {
                    select_spec: items
                };
            }
        } else {
            // single select
            result['select_specs'] = {
                select_spec: this.processSelect(target, questionFlag)
            };
        }

        // process filters
        if ('filter_specs' in sentence) {
            target = sentence.filter_specs.filter_spec;

            if (Array.isArray(target)) {
                // multiple
                const items: any[] = [];
                target.forEach(filter => {
                    if (!(filter.how_hash === 0 && filter.what_hash === 0 && filter.how_reg_ex === '')) {
                        items.push(this.processFilter(filter));
                    }
                });

                if (items.length !== 0) {
                    result['group'] = {
                        sentence: {
                            not_flag: 0,
                            and_flag: 1,
                            filter_specs: {
                                filter_spec: items
                            }
                        }
                    };
                }
            } else {
                // single
                if (!(target.how_hash === 0 && target.what_hash === 0 && target.how_reg_ex === '')) {
                    result['group'] = {
                        sentence: {
                            not_flag: 0,
                            and_flag: 1,
                            filter_specs: {
                                filter_spec: this.processFilter(target)
                            }
                        }
                    };
                }
            }

        }
        return result;
    }

    static processFilter(filter: any): any {
        if (filter['how_hash'] === 0) {
            this.deleteProperty(filter, 'how_hash');
        }

        this.deleteProperty(filter, 'delimiter');
        this.deleteProperty(filter, 'delimiter_index');

        this.deleteProperty(filter, 'start_time');
        this.deleteProperty(filter, 'end_time');

        // remove sensor
        this.deleteProperty(filter, 'sensor');

        return filter;
    }

    static processSelect(select: any, questionFlag: boolean) {
        var result: any = {
            type: 'select'
        };

        if ('sensor' in select) {
            result['sensor'] = {
                name: select['sensor']['name']
            };
            this.transpond(select, result, 'what_hash');
        }

        if ('temp_sensor' in select) {
            result['sensor'] = {
                name: select['temp_sensor']['display_name']
            };
            this.transpond(select['temp_sensor']['sensor'], result, 'what_hash');
        }

        if ('greater_flag' in select && select['greater_flag'] === 1 && 'equal_flag' in select && select['equal_flag'] === 1) {
            this.transpond(select, result, 'how_reg_ex');
            result['equal_flag'] = 0;
            result['not_flag'] = 0;
            result['greater_flag'] = 0;
            this.transpond(select, result, 'result_type');
            result['aggregation'] = 0;
            this.transpond(select, result, 'all_times_flag');
            this.transpond(select, result, 'all_values_flag');
            result['delimiter'] = 0;
            this.transpond(select, result, 'delimiter_index');
            this.transpond(select, result, 'ignore_case_flag');
            this.transpond(select, result, 'max_age_seconds');
        } else {
            this.transpond(select, result, 'how_reg_ex');
            this.transpond(select, result, 'equal_flag');
            this.transpond(select, result, 'not_flag');
            this.transpond(select, result, 'greater_flag');
            this.transpond(select, result, 'result_type');
            
            if (questionFlag) {
                result['aggregation'] = TransformSelect.fromSOAPAggregation(select['aggregation']);
            } else {
                this.transpond(select, result, 'aggregation');
            }

            this.transpond(select, result, 'all_times_flag');
            this.transpond(select, result, 'all_values_flag');

            if (questionFlag) {
                result['delimiter'] = 0;
            } else {
                result['delimiter'] = (select.delimiter.length === 0) ? 0 : select.delimiter;
            }

            this.transpond(select, result, 'delimiter_index');
            this.transpond(select, result, 'ignore_case_flag');
            this.transpond(select, result, 'max_age_seconds');
        }

        if ('start_time' in select) {
            result['start_time'] = (select.start_time.startsWith('2001') || select.start_time.startsWith('1900')) ? '' : select.start_time;
            result['end_time'] = (select.end_time.startsWith('2001') || select.end_time.startsWith('1900')) ? '' : select.end_time;
        } else {
            result['start_time'] = '';
            result['end_time'] = '';
        }
        // this.transpond(select, result, 'utf8_flag');

        return result;
    }

    static transform(savedQuestion: any) {
        const p = new Promise(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(savedQuestion, result, 'name');
                this.transpondBooleanToInteger(savedQuestion, result, 'public_flag');
                this.transpond(savedQuestion, result, 'issue_seconds');
                this.transpondBooleanToInteger(savedQuestion, result, 'issue_seconds_never_flag');
                this.transpond(savedQuestion, result, 'expire_seconds');
                this.transpondBooleanToInteger(savedQuestion, result, 'row_count_flag');
                this.transpondBooleanToIntegerNewNameInverse(savedQuestion, result, 'archive_enabled_flag', 'disabled_flag');
                this.transpondBooleanToInteger(savedQuestion, result, 'hidden_flag');
                this.transpond(savedQuestion, result, 'keep_seconds');
                result['question'] = await TransformQuestion.transform(savedQuestion['question']);

                if (savedQuestion.packages.length === 0) {
                    result['packages'] = '';
                } else {
                    var target = savedQuestion['packages'];
                    if (target.length === 1) {
                        // single
                        result['packages'] = {
                            tanium_package: {
                                name: target[0].name
                            }
                        };
                    } else {
                        // multiple
                        var taniumPackages: any[] = [];
                        target.forEach((item: any) => taniumPackages.push({
                            name: item.name
                        }));
                        result['packages'] = {
                            tanium_package: taniumPackages
                        };
                    }
                }

                return resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedQuestion.transform', err);
                return reject();
            }
        });

        return p;
    }
}