import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformGroup } from "./TransformGroup";

export class TransformSavedAction extends TransformBase {
    static transformCs(savedAction: any) {
        const p = new Promise<any>((resolve, reject) => {
            try {
                this.deleteProperty(savedAction, 'tanium_package');
                this.deleteProperty(savedAction, 'content_set');

                // remove sensor data from filters
                if ('group' in savedAction.group) {
                    if ('sentence' in savedAction.group.group) {
                        if ('filter_specs' in savedAction.group.group.sentence) {
                            if ('filter_spec' in savedAction.group.group.sentence.filter_specs) {
                                if (Array.isArray(savedAction.group.group.sentence.filter_specs.filter_spec)) {
                                    savedAction.group.group.sentence.filter_specs.filter_spec.forEach((filter: any) => {
                                        this.deleteProperty(filter, 'sensor');
                                        this.deleteProperty(filter, 'delimiter');
                                        this.deleteProperty(filter, 'delimiter_index');
                                    });
                                }
                            }
                        }
                    }
                }

                resolve(savedAction);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedAction.transformCs', err);
                reject();
            }
        });

        return p;
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
                this.transpondBooleanToInteger(savedAction, result, 'policy_flag');

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

                resolve(result);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedAction.transform', err);
                reject();
            }
        });

        return p;
    }
}