/* eslint-disable @typescript-eslint/naming-convention */
import { TransformMetadataItem } from "./transform-metadata-item";
import { TransformBase } from "./TransformBase";

export class TransformPackage extends TransformBase {
    static transformCs(taniumPackage: any) {
        if (taniumPackage['signature'] === '') {
            delete taniumPackage.signature;
        }

        if (taniumPackage['meta_data'] === '') {
            delete taniumPackage.meta_data;
        }


        if ('package_files' in taniumPackage) {
            const val = taniumPackage['package_files']['package_file'];
            if ((val || "") !== "") {
                if (Array.isArray(val) && val.length !== 1) {
                    // sort by file_name
                    val.sort((a: any, b: any) => (a.file_name > b.file_name) ? 1 : -1);

                    taniumPackage['package_files']['package_file'] = val;
                }
            }
        }

        if ('sensors' in taniumPackage) {
            delete taniumPackage.sensors;
        }

        if ('content_set' in taniumPackage) {
            delete taniumPackage.content_set;
        }

        return taniumPackage;
    }

    static transform(taniumPackage: any) {
        var result: any = {};

        this.transpond(taniumPackage, result, 'name');
        this.transpond(taniumPackage, result, 'display_name');
        this.transpondNewName(taniumPackage, result, 'command', 'command_line');
        this.transpondNewName(taniumPackage, result, 'parameter_definition', 'prompt_text');
        this.transpondNewName(taniumPackage, result, 'command_timeout', 'command_line_timeout');
        this.transpond(taniumPackage, result, 'hidden_flag');
        this.transpond(taniumPackage, result, 'process_group_flag');
        this.transpond(taniumPackage, result, 'skip_lock_flag');
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

        if (taniumPackage.verify_group.name === '') {
            result['verify_group'] = {
                "group": {
                    "id": 0
                }
            };
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