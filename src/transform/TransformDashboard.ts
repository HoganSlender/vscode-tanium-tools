/* eslint-disable @typescript-eslint/naming-convention */
import { TransformBase } from "./TransformBase";

export class TransformDashboard extends TransformBase {
    static transformCs(dashboard: any) {
        var result:  any = {};

        this.transpond(dashboard, result, 'name');
        this.transpond(dashboard, result, 'public_flag');
        this.transpond(dashboard, result, 'text');

        // adjust saved questions
        var target = dashboard['saved_questions']['saved_question'];
        if (Array.isArray(target)) {
            // multiple
            var savedQuestions: any[] = [];
            target.forEach(savedQuestion => savedQuestions.push({
                name: savedQuestion.name
            }));
            result['saved_questions'] = {
                saved_question: savedQuestions
            };
        } else {
            // singular
            result['saved_questions'] = {
                saved_question: {
                    name: dashboard['saved_questions']['saved_question']['name']
                }
            };
        }

        return result;
    }

    static transform(dashboard: any) {
        var result: any = {};

        this.transpond(dashboard, result, 'name');
        this.transpond(dashboard, result, 'public_flag');
        this.transpond(dashboard, result, 'text');

        var target = dashboard['saved_question_list'];
        if (target.length === 1) {
            // single
            result['saved_questions'] = {
                saved_question: {
                    name: target[0].name
                }
            };
        } else {
            // multiple
            var savedQuestions: any[] = [];
            target.forEach((item: any) => savedQuestions.push(item));
            result['saved_questions'] = {
                saved_question: savedQuestions
            };
        }

        return result;
    }
}