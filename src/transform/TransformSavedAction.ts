/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { SavedQuestions } from "../services/SavedQuestions";
import { TransformBase } from "./TransformBase";
import { TransformGroup } from "./TransformGroup";

export class TransformSavedAction extends TransformBase {
    static transformCs(savedAction: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                this.deleteProperty(savedAction, 'content_set');
                this.deleteProperty(savedAction, 'start_time');
                this.deleteProperty(savedAction, 'policy_sq');
                this.deleteProperty(savedAction, 'policy_sq');
                this.deleteProperty(savedAction, 'policy_row_filter_group');
                this.deleteProperty(savedAction, 'policy_flag');

                // remove sensor data from filters
                if ('group' in savedAction.group) {
                    // kill name
                    this.deleteProperty(savedAction.group, 'name');

                    var target = savedAction.group.group;

                    if (Array.isArray(target)) {
                        target.forEach(item => {
                            this.processGroup(item);
                        });
                    } else {
                        this.processGroup(target);
                    }
                }

                // adjust tanium_package
                savedAction['tanium_package'] = {
                    name: savedAction['tanium_package']['name'],
                    display_name: savedAction['tanium_package']['display_name']
                };

                resolve(savedAction);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedAction.transformCs', err);
                reject();
            }
        });

        return p;
    }

    static processGroup(item: any) {
        this.deleteProperty(item, 'name');

        if ('sentence' in item) {
            if ('filter_specs' in item.sentence) {
                if (item.sentence.filter_specs !== '' && 'filter_spec' in item.sentence.filter_specs) {
                    var target = item.sentence.filter_specs.filter_spec;
                    if (Array.isArray(target)) {
                        target.forEach((filter: any) => {
                            this.processFilterGroup(filter);
                        });
                    } else {
                        this.processFilterGroup(target);
                    }
                }
            }
        }
    }

    static processFilterGroup(filter: any) {
        this.transpondIntegerToString(filter, filter, 'how_reg_ex');
        this.deleteProperty(filter, 'sensor');
        this.deleteProperty(filter, 'delimiter');
        this.deleteProperty(filter, 'delimiter_index');
    }

    static transform(savedAction: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(savedAction, result, 'name');
                this.transpond(savedAction, result, 'issue_seconds');
                this.transpond(savedAction, result, 'expire_seconds');
                this.transpondBooleanToInteger(savedAction, result, 'public_flag');
                this.transpond(savedAction, result, 'status');
                this.transpond(savedAction, result, 'comment');

                if (savedAction.policy_flag) {
                    if ('policy' in savedAction) {
                        if ('max_age' in savedAction.policy) {
                            result['policy_max_age'] = savedAction.policy.max_age;
                        }
                    }
                } else {
                    result['policy_max_age'] = 0;
                }

                this.transpond(savedAction, result, 'distribute_seconds');

                if ('row_ids' in savedAction) {
                    result['row_ids'] = savedAction['row_ids'];
                } else {
                    result['row_ids'] = '';
                }

                // convert target_group
                result['group'] = await TransformGroup.transform(savedAction.target_group);

                // adjust package_spec
                result['tanium_package'] = {
                    name: savedAction['package_spec']['name'],
                    display_name: savedAction['package_spec']['display_name'],
                };

                resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedAction.transform', err);
                reject();
            }
        });

        return p;
    }
}