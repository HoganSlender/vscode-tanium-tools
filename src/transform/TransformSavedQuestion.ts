/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformQuestion } from "./TransformQuestion";

export class TransformSavedQuestion extends TransformBase {
    static transformCs(savedQuestion: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                // if ('question' in savedQuestion) {
                //     savedQuestion['question'] = await TransformQuestion.transformCs(savedQuestion.question);
                // }

                this.deleteProperty(savedQuestion, 'question');
                this.deleteProperty(savedQuestion, 'sentence');

                this.deleteProperty(savedQuestion, 'merge_flag');
                this.deleteProperty(savedQuestion, 'drilldown_flag');
                this.deleteProperty(savedQuestion, 'default_tab');
                this.deleteProperty(savedQuestion, 'default_grid_zoom_level');
                this.deleteProperty(savedQuestion, 'default_line_zoom_level');

                // remove metadata
                this.deleteProperty(savedQuestion, 'meta_data');

                // remove content set
                this.deleteProperty(savedQuestion, 'content_set');

                // process packages
                if ('packages' in savedQuestion) {
                    var target = savedQuestion['packages']['tanium_package'];
                    if (Array.isArray(target)) {
                        // multiple
                        var packages: any[] = [];
                        target.forEach(taniumPackage => packages.push({
                            name: taniumPackage.name
                        }));
                        savedQuestion['packages'] = {
                            tanium_package: packages
                        };
                    } else {
                        // singular
                        savedQuestion['packages'] = {
                            tanium_package: {
                                name: savedQuestion['packages']['tanium_package']['name']
                            }
                        };
                    }
                }

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

                // if ('question' in savedQuestion) {
                //     result['question'] = await TransformQuestion.transform(savedQuestion.question);
                // }

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