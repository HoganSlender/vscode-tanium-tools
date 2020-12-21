import path = require('path');
import * as fs from 'fs';
import { OutputChannelLogging } from './logging';

const diffMatchPatch = require('diff-match-patch');

export interface DiffItemData {
    missing: any[],
    modified: any[],
    created: any[],
    unchanged: any[],
}

export class PathUtils {
    static getPath(input: string): string {
        var items = input.split(path.sep);

        return input.replace(path.sep + items[items.length - 1], '');
    }

    static getDiffItems(leftDir: string, rightDir: string, checkForComments?: boolean, dontCheckCreated?: boolean) {
        const p: Promise<DiffItemData> = new Promise<DiffItemData>((resolve, reject) => {
            try {
                const files: string[] = fs.readdirSync(leftDir);
                const leftTargets: string[] = [];

                const retval: DiffItemData = {
                    missing: [],
                    modified: [],
                    created: [],
                    unchanged: [],
                };

                files.forEach(file => {
                    const leftTarget = path.join(leftDir, file);
                    const rightTarget = leftTarget.replace(leftDir, rightDir);

                    leftTargets.push(leftTarget);

                    if (!fs.existsSync(rightTarget)) {
                        // missing
                        retval.missing.push({
                            name: file.replace('.json', ''),
                            path: leftTarget + '~~' + rightTarget,
                        });
                    } else {
                        // modified or unchanged
                        // compare left and right contents
                        var lContents = fs.readFileSync(leftTarget, 'utf-8');
                        var rContents = fs.readFileSync(rightTarget, 'utf-8');

                        if (lContents !== rContents) {
                            // contents are different

                            // if we want to check for whitespace/comments changes only
                            if (checkForComments) {
                                // check to see is changes are comments only
                                if (this.isComment(lContents, rContents)) {
                                    retval.unchanged.push({
                                        name: file.replace('.json', ''),
                                        path: leftTarget + '~~' + rightTarget,
                                    });
                                } else {
                                    retval.modified.push({
                                        name: file.replace('.json', ''),
                                        path: leftTarget + '~~' + rightTarget,
                                    });
                                }
                            } else {
                                retval.modified.push({
                                    name: file.replace('.json', ''),
                                    path: leftTarget + '~~' + rightTarget,
                                });
                            }
                        } else {
                            // contents are the same
                            retval.unchanged.push({
                                name: file.replace('.json', ''),
                                path: leftTarget + '~~' + rightTarget,
                            });
                        }
                    }
                });

                // now check for created
                if (!dontCheckCreated) {
                    const rightFiles: string[] = fs.readdirSync(rightDir);

                    rightFiles.forEach(file => {
                        const rightTarget = path.join(rightDir, file);
                        const leftTarget = rightTarget.replace(rightDir, leftDir);

                        if (!leftTargets.includes(leftTarget)) {
                            retval.created.push({
                                name: file.replace('.json', ''),
                                path: rightTarget
                            });
                        }
                    });

                }
                resolve(retval);

            } catch (err) {
                OutputChannelLogging.logError('error in getDiffItems', err);
                reject();
            }
        });

        return p;
    }

    private static isComment(lContents: string, rContents: string): boolean {
        const dmp = new diffMatchPatch();
        const diffs = dmp.diff_main(lContents, rContents);
        dmp.diff_cleanupSemantic(diffs);


        var onlyComments = true;
        var allEqual = true;

        diffs.forEach((diff: any) => {
            const operation: number = diff[0];
            const text: string = diff[1];

            if (operation !== diffMatchPatch.DIFF_EQUAL) {
                allEqual = false;

                // trim text
                var test = text.trim();

                if (test.length !== 0) {
                    var first = test.substr(0, 1);
                    if (first === '"') {
                        first = test.substr(1, 1);
                    }

                    if (first !== '#' && first !== "'" && first !== ',') {
                        // last check, strip " and ,
                        test = test.replace(/\"/g, '').replace(/\,/g, '');
                        if (test.length !== 0) {
                            onlyComments = false;
                        }
                    }
                }
            }
        });

        return (onlyComments && !allEqual);
    }
}