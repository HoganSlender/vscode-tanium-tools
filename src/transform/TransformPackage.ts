/* eslint-disable @typescript-eslint/naming-convention */
import { TransformMetadataItem } from "./transform-metadata-item";
import { TransformBase } from "./TransformBase";

export class TransformPackage extends TransformBase {
    static transformCs(taniumPackage: any) {
        var result: any = {};

        this.transpond(taniumPackage, result, 'name');
        this.transpond(taniumPackage, result, 'display_name');
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
            if ('group' in taniumPackage['verify_group']) {
                if (taniumPackage['verify_group']['group']['id'] === 0) {
                    //this.deleteProperty(taniumPackage, 'verify_group');
                } else {
                    this.transpond(taniumPackage, result, 'verify_group');
                }
            }
        }

        this.transpond(taniumPackage, result, 'meta_data');

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

        return result;
    }

    static transform(taniumPackage: any) {
        var result: any = {};

        this.transpond(taniumPackage, result, 'name');
        this.transpond(taniumPackage, result, 'display_name');
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

        if ('metadata' in taniumPackage) {
            const val = taniumPackage['metadata'];
            if ((val || "") !== "") {
                if (Array.isArray(val) && val.length === 1) {
                    result['meta_data'] = {
                        meta_data_item: TransformMetadataItem.transform(val[0]),
                    };
                } else {
                    var items: any[] = [];

                    for (var i = 0; val && i < val.length; i++) {
                        items.push(TransformMetadataItem.transform(val[i]));
                    }

                    // sort by name
                    items.sort((a, b) => (a.name > b.name) ? 1 : -1);

                    if (items.length !== 0) {
                        result['meta_data'] = {
                            meta_data_item: items
                        };
                    }
                }
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

        return result;
    }
}