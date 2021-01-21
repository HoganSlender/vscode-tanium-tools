/* eslint-disable @typescript-eslint/naming-convention */
import { OutputChannelLogging } from "../common/logging";
import { TransformBase } from "./TransformBase";
import { TransformGroup } from "./TransformGroup";
import { TransformMetaData } from "./TransformMetaData";

export class TransformPackage extends TransformBase {
    static transformCs(taniumPackage: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(taniumPackage, result, 'name');
                if (taniumPackage['name'] !== taniumPackage['display_name']) {
                    this.transpond(taniumPackage, result, 'display_name');
                }
                this.transpond(taniumPackage, result, 'command_line');

                // convert prompt text to object and stringify
                if ('prompt_text' in taniumPackage) {
                    if (taniumPackage['prompt_text'] !== '') {
                        try {
                            result['prompt_text'] = this.convertWhitespace(JSON.stringify(JSON.parse(taniumPackage['prompt_text']), null, 2));

                        } catch (err) {
                            console.log('helo');
                        }
                    }
                }

                this.transpond(taniumPackage, result, 'command_line_timeout');
                this.transpond(taniumPackage, result, 'hidden_flag');
                this.transpond(taniumPackage, result, 'process_group_flag');
                this.transpond(taniumPackage, result, 'verify_expire_seconds');

                if ('download_seconds' in taniumPackage) {
                    this.transpond(taniumPackage, result, 'download_seconds');
                } else {
                    result['download_seconds'] = 600;
                }

                if ('verify_group' in taniumPackage) {
                    if ('group' in taniumPackage['verify_group'] && 'id' in taniumPackage['verify_group']['group'] && taniumPackage['verify_group']['group']['id'] === 0) {
                        // do nothing
                    } else {
                        taniumPackage['verify_group'] = await TransformGroup.transformCs(taniumPackage['verify_group']['group']);
                        this.transpond(taniumPackage, result, 'verify_group');
                    }
                }

                if ('meta_data' in taniumPackage) {
                    if (taniumPackage['meta_data'] !== '') {
                        taniumPackage['meta_data'] = await TransformMetaData.transformCs(taniumPackage['meta_data']);
                        this.transpond(taniumPackage, result, 'meta_data');
                    }
                }

                if ('parameters' in taniumPackage) {
                    if (taniumPackage['parameters'] !== '') {
                        result['parameters'] = taniumPackage['parameters'];
                    }
                }

                if ('package_files' in taniumPackage) {
                    const val = taniumPackage['package_files']['package_file'];
                    if ((val || "") !== "") {
                        if (Array.isArray(val)) {
                            // sort by file_name
                            val.sort((a: any, b: any) => (a.file_name > b.file_name) ? 1 : -1);

                            result['package_files'] = {
                                package_file: val
                            };
                        } else {
                            result['package_files'] = {
                                package_file: val
                            };
                        }
                    }
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TranformPackage.transformCs', err);
                return reject();
            }
        });

        return p;
    }

    static transform(taniumPackage: any) {
        const p = new Promise<any>(async (resolve, reject) => {
            try {
                var result: any = {};

                this.transpond(taniumPackage, result, 'name');
                if (taniumPackage['name'] !== taniumPackage['display_name']) {
                    this.transpond(taniumPackage, result, 'display_name');
                }
                this.transpondNewName(taniumPackage, result, 'command', 'command_line');

                if ('parameter_definition' in taniumPackage) {
                    if (taniumPackage['parameter_definition'] !== '') {
                        taniumPackage['parameter_definition'] = this.convertWhitespace(JSON.stringify(JSON.parse(taniumPackage['parameter_definition']), null, 2));
                        this.transpondNewName(taniumPackage, result, 'parameter_definition', 'prompt_text');
                    }
                }

                this.transpondNewName(taniumPackage, result, 'command_timeout', 'command_line_timeout');
                this.transpond(taniumPackage, result, 'hidden_flag');
                this.transpond(taniumPackage, result, 'process_group_flag');
                this.transpond(taniumPackage, result, 'verify_expire_seconds');

                result['download_seconds'] = taniumPackage['expire_seconds'] - taniumPackage['command_timeout'];

                if ('filters' in taniumPackage['verify_group']) {
                    result['verify_group'] = await TransformGroup.transform(taniumPackage.verify_group);
                    //this.transpond(taniumPackage, result, 'verify_group');
                }

                if ('metadata' in taniumPackage) {
                    if (taniumPackage['metadata'].length !== 0) {
                        result['meta_data'] = await TransformMetaData.transform(taniumPackage['metadata']);
                    }
                }

                if ('files' in taniumPackage) {
                    const val = taniumPackage['files'];
                    if ((val || "") !== "") {
                        if (Array.isArray(val) && val.length === 1) {
                            result['package_files'] = {
                                package_file: {
                                    file_name: val[0].name,
                                    source: val[0].source,
                                    size: val[0].size,
                                    type: val[0].source === '' ? 0 : 1,
                                    download_seconds: val[0].download_seconds,
                                    hash: val[0].hash
                                }
                            };
                        } else {
                            var items: any[] = [];

                            for (var i = 0; val && i < val.length; i++) {
                                items.push({
                                    file_name: val[i].name,
                                    source: val[i].source,
                                    size: val[i].size,
                                    type: val[i].source === '' ? 0 : 1,
                                    download_seconds: val[i].download_seconds,
                                    hash: val[i].hash
                                });
                            }

                            // sort by name
                            items.sort((a, b) => (a.file_name > b.file_name) ? 1 : -1);

                            if (items.length !== 0) {
                                result['package_files'] = {
                                    package_file: items
                                };
                            }
                        }
                    }
                }

                return resolve(result);

            } catch (err) {
                OutputChannelLogging.logError('TranformPackage.transform', err);
                return reject();
            }
        });

        return p;
    }
}