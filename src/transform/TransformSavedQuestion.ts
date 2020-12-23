import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformQuestion } from "./TransformQuestion";

export class TransformSavedQuestion extends TransformBase {
    static transformCs(savedQuestion: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                savedQuestion['question'] = await TransformQuestion.transformCs(savedQuestion.question);

                // remove metadata
                this.deleteProperty(savedQuestion, 'meta_data');

                // remove content set
                this.deleteProperty(savedQuestion, 'content_set');

                return resolve(savedQuestion);
            } catch (err) {
                OutputChannelLogging.logError('error in TransformSavedQuestion.transformCs', err);
                return reject();
            }
        });

        return p;
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
                this.transpondNewName(savedQuestion, result, 'query_text', 'text');

                result['question'] = await TransformQuestion.transform(savedQuestion.question);

                if (savedQuestion.packages.length === 0) {
                    result['packages'] = '';
                } else {
                    result['packages'] = savedQuestion.packages;
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