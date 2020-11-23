import path = require('path');
import * as fs from 'fs';

export class PathUtils {
    static getPath(input: string): string {
        var items = input.split(path.sep);

        return input.replace(path.sep + items[items.length - 1], '');
    }

    static getMissingItems(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var missing: any[] = [];

            if (files.length === 0) {
                resolve(missing);
            } else {
                for (var i = 0; i < files.length; i++) {
                    const file = files[i];
                    const leftTarget = path.join(leftDir, file);
                    const rightTarget = leftTarget.replace(leftDir, rightDir);

                    if (!fs.existsSync(rightTarget)) {
                        missing.push({
                            name: file.replace('.json', ''),
                            path: leftTarget + '~~' + rightTarget,
                        });
                    }

                    if (i === files.length - 1) {
                        resolve(missing);
                    }
                }
            }
        });

        return p;
    }

    static getModifiedItems(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var modified: any[] = [];

            if (files.length === 0) {
                resolve(modified);
            } else {
                for (var i = 0; i < files.length; i++) {
                    const file = files[i];
                    const leftTarget = path.join(leftDir, file);
                    const rightTarget = leftTarget.replace(leftDir, rightDir);

                    if (fs.existsSync(rightTarget)) {
                        // compare left and right contents
                        var lContents = fs.readFileSync(leftTarget, 'utf-8');
                        var rContents = fs.readFileSync(rightTarget, 'utf-8');

                        if (lContents !== rContents) {
                            modified.push({
                                name: file.replace('.json', ''),
                                path: leftTarget + '~~' + rightTarget,
                            });
                        }
                    }

                    if (i === files.length - 1) {
                        resolve(modified);
                    }
                }
            }
        });

        return p;
    }

    static getCreatedItems(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(rightDir);
            var created: any[] = [];

            if (files.length === 0) {
                resolve(created);
            } else {
                for (var i = 0; i < files.length; i++) {
                    const file = files[i];
                    const rightTarget = path.join(rightDir, file);
                    const leftTarget = rightTarget.replace(rightDir, leftDir);

                    if (!fs.existsSync(leftTarget)) {
                        created.push({
                            name: file.replace('.json', ''),
                            path: rightTarget
                        });
                    }

                    if (i === files.length - 1) {
                        resolve(created);
                    }
                }
            }
        });

        return p;
    }

    static getUnchangedItems(leftDir: string, rightDir: string): Promise<any[]> {
        const p: Promise<string[]> = new Promise((resolve, reject) => {
            const files: string[] = fs.readdirSync(leftDir);
            var unchanged: any[] = [];

            if (files.length === 0) {
                resolve(unchanged);
            } else {
                for (var i = 0; i < files.length; i++) {
                    const file = files[i];
                    const leftTarget = path.join(leftDir, file);
                    const rightTarget = leftTarget.replace(leftDir, rightDir);

                    if (fs.existsSync(rightTarget)) {
                        // compare left and right contents
                        var lContents = fs.readFileSync(leftTarget, 'utf-8');
                        var rContents = fs.readFileSync(rightTarget, 'utf-8');

                        if (lContents === rContents) {
                            unchanged.push({
                                name: file.replace('.json', ''),
                                path: leftTarget + '~~' + rightTarget,
                            });
                        }
                    }

                    if (i === files.length - 1) {
                        resolve(unchanged);
                    }
                }
            }
        });

        return p;
    }
}