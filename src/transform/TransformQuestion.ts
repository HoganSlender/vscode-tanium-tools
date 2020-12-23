/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformSelect } from "./TransformSelect";

export class TransformQuestion extends TransformBase {
    static transformCs(question: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                // transform selects
                if (Array.isArray(question.select_specs.select_spec)) {
                    var selects: any[] = [];
                    for (var i = 0; i < question.select_specs.select_spec.length; i++) {
                        const selectSpec = question.select_specs.select_spec[i];
                        selects.push(await TransformSelect.transformCs(selectSpec));
                    }
                    question.select_specs.select_spec = selects;
                } else {
                    question.select_specs.select_spec = await TransformSelect.transformCs(question.select_specs.select_spec);
                }

                // delete group
                this.deleteProperty(question, 'group');

                return resolve(question);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformQuestion.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    static transform(question: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpondNewName(question, result, 'query_text', 'text');
                this.transpondBooleanToInteger(question, result, 'skip_lock_flag');
                this.transpondBooleanToInteger(question, result, 'force_computer_id_flag');

                var selects: any[] = [];
                for (var i = 0; i < question.selects.length; i++) {
                    const select = question.selects[i];
                    selects.push(await TransformSelect.transform(select));
                }

                if (selects.length === 1) {
                    result['select_specs'] = {
                        select_spec: selects[0]
                    };
                } else {
                    result['select_specs'] = {
                        select_spec: selects
                    };
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('error in TransformQuestion.transform', err);
                return reject();
            }
        });

        return p;
    }
}