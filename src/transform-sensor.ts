/* eslint-disable @typescript-eslint/naming-convention */
import lodash = require('lodash');
import { TransformParameter } from './transform-parameter';
import { TransformMetadataItem } from './transform-metadata-item';
import got = require('got');
import { values } from 'lodash';

export class TransformSensor {
    public static transform(sensor: any): any {
        var result: any = TransformSensor.doTransform(sensor);

        return result;
    }

    public static transformContentSet(sensor: any): any {
        var result: any = TransformSensor.doTransformContentSet(sensor);

        return result;
    }

    private static doTransformContentSet(sensor: any) {
        var result: any = {};

        for (var p in sensor) {
            if (p in TransformSensor._propertyMapContentSet) {
                if (typeof (TransformSensor._propertyMapContentSet[p]) === "function") {
                    TransformSensor._propertyMapContentSet[p](result, sensor[p]);
                } else {
                    result[TransformSensor._propertyMapContentSet[p]] = sensor[p];
                }
            }
        }

        return result;
    }

    private static doTransform(sensor: any) {
        var result: any = {};
        TransformSensor.mapProperty('name', sensor, result);
        TransformSensor.mapProperty('value_type', sensor, result);
        TransformSensor.mapProperty('max_age_seconds', sensor, result);
        TransformSensor.mapProperty('max_string_age_minutes', sensor, result);
        TransformSensor.mapProperty('ignore_case_flag', sensor, result);
        TransformSensor.mapProperty('category', sensor, result);
        TransformSensor.mapProperty('exclude_from_parse_flag', sensor, result);
        TransformSensor.mapProperty('delimiter', sensor, result);
        TransformSensor.mapProperty('description', sensor, result);
        TransformSensor.mapProperty('hash', sensor, result);
        TransformSensor.mapProperty('hidden_flag', sensor, result);
        TransformSensor.mapProperty('subcolumns', sensor, result);
        TransformSensor.mapProperty('queries', sensor, result);
        TransformSensor.mapProperty('metadata', sensor, result);
        TransformSensor.mapProperty('parameter_definition', sensor, result);
        TransformSensor.mapProperty('content_set', sensor, result);

        return result;
    }

    private static mapProperty(name: string, sensor: any, result: any) {
        if (name in TransformSensor._propertyMap) {
            if (typeof (TransformSensor._propertyMap[name]) === "function") {
                TransformSensor._propertyMap[name](result, sensor[name]);
            } else {
                result[TransformSensor._propertyMap[name]] = sensor[name];
            }
        }
    }

    private static _propertyMapContentSet: any = {
        'content_set': function (result: any, val: any) {
            result['content_set'] = {
                name: val.name
            };
        },
        'name': 'name',
        'result_type': 'result_type',
        'qseconds': 'qseconds',
        'max_string_age_minutes': 'max_string_age_minutes',
        'max_strings': 'max_strings',
        'what_hash': 'what_hash',
        'category': 'category',
        'description': function (result: any, val: any) {
            if ((val || "") !== "") {
                result['description'] = TransformSensor.convertWhitespace(val);
            }
        },
        'hidden_flag': function (result: any, val: any) {
            if ((val || "") !== "") {
                if (val) {
                    result['hidden_flag'] = 1;
                }
            }
        },
        'ignore_case_flag': 'ignore_case_flag',
        //'exclude_from_parse': 'exclude_from_parse',
        'delimiter': function (result: any, val: any) {
            if ((val || "") !== "") {
                result['delimiter'] = val;
            }
        },
        'parameters': function (result: any, val: any) {
            if ((val || "") !== "") {
                delete val.param;
                result['parameters'] = val;
            }
        },
        'queries': function (result: any, val: any) {
            // sort by os type
            val.sensor_query.sort((a: any, b: any) => (a.os > b.os) ? 1 : -1);

            // clean up query entry
            val.sensor_query.forEach((sensorQuery: any) => {
                var query: string = sensorQuery.query;
                sensorQuery.query = TransformSensor.convertWhitespace(query);

                if (sensorQuery.signature === 'null') {
                    sensorQuery.signature = '';
                }
            });

            result['queries'] = val;
        },
        'columns': function (result: any, val: any) {
            if ((val || "") !== "") {
                // remove exclude_from_parse
                if (Array.isArray(val.column)) {
                    val.column.forEach((column: any) => {
                        delete column.exclude_from_parse;
                    });
                } else {
                    delete val.column.exclude_from_parse;
                }
                result['columns'] = val;
            } else {
                result['columns'] = '';
            }
        },
        'meta_data': function(result: any, val: any) {
            if ((val || "") !== "") {
                result['meta_data'] = val;
            }
        },
    };

    private static _propertyMap: any = {
        'content_set': function (result: any, val: any) {
            result['content_set'] = {
                name: val.name
            };
        },
        'name': 'name',
        'value_type': function (result: any, val: string) {
            result['result_type'] = TransformSensor.soapValueTypeToResultType(val);
        },
        'max_age_seconds': 'qseconds',
        'max_string_age_minutes': 'max_string_age_minutes',
        'max_strings': 'max_strings',
        'hash': function (result: any, val: string) {
            result['what_hash'] = Number(val);
        },
        'category': 'category',
        'description': function (result: any, val: any) {
            if ((val || "") !== "") {
                result['description'] = TransformSensor.convertWhitespace(val);
            }
        },
        'hidden_flag': function (result: any, val: string) {
            if ((val || "") !== "") {
                if (val) {
                    result['hidden_flag'] = 1;
                }
            }
        },
        'ignore_case_flag': function (result: any, val: string) {
            result['ignore_case_flag'] = val ? 1 : 0;
        },
        //'exclude_from_parse_flag': 'exclude_from_parse',
        'delimiter': function (result: any, val: any) {
            if ((val || "") !== "") {
                result['delimiter'] = val;
            }
        },
        'parameter_definition': function (result: any, val: string) {
            if ((val || "") !== "") {
                result['parameters'] = {
                    parameter_text: val
                };
            }
        },
        'parameters': function (result: any, val: any[]) {
            if (val) {
                var params = lodash.map(val, (p) => {
                    // this function is called on the result of sensor.toObject()
                    // hence the need for '.parameter' here.
                    if (p && p.parameter) {
                        return TransformParameter.transform(p.parameter);
                    } else {
                        return null;
                    }
                });
                params = lodash.filter(params, (p) => p !== null);
                if (params.length > 0) {
                    var tmpArray: any[] = [];
                    lodash.forEach(params, (param) => {
                        tmpArray.push({ 'param': param });
                    });
                    result['parameters'] = tmpArray;
                }
            }
        },
        'queries': function (result: any, val: any) {
            var queries: any[] = [];
            result['queries'] = {};
            for (var i = 0; i < val.length; i++) {
                queries.push(TransformSensor._transformSensorQuery(val[i]));
            }

            // sort by os type
            queries.sort((a, b) => (a.os > b.os) ? 1 : -1);

            result['queries']['sensor_query'] = queries;
        },
        'subcolumns': function (result: any, val: any) {
            if ((val || "") === "") {
                result['columns'] = '';
            } else {
                result['columns'] = {
                    column: []
                };
                for (var i = 0; val && i < val.length; i++) {
                    //var exclude_from_parse = val[i].subcolumn.exclude_from_parse_flag === 0 ? 0 : 1;
                    result['columns']['column'].push(
                        {
                            'name': val[i].name,
                            'column_index': val[i].index,
                            'hidden_flag': val[i].hidden_flag ? 1 : 0,
                            'ignore_case_flag': val[i].ignore_case_flag ? 1 : 0,
                            'result_type': TransformSensor.soapValueTypeToResultType(val[i].value_type),
                        }
                    );
                }
            }
        },
        'metadata': function (result: any, val: any) {
            if ((val || "") !== "") {
                if (val.length === 1) {
                    result['meta_data'] = {
                        meta_data_item: TransformMetadataItem.transform(val[0]),
                    };
                } else {
                    result['meta_data'] = {
                        meta_data_item: []
                    };
                    for (var i = 0; val && i < val.length; i++) {
                        result['meta_data']['meta_data_item'].push(TransformMetadataItem.transform(val[i]));
                    }
                }
            }
        }
    };

    private static convertWhitespace(input: string) {
        var converted = input.replace(/\r/g, '').split(/\n/);
        if (converted[converted.length - 1] === '') {
            converted.pop();
        }

        return converted;
    }

    private static soapValueTypeToResultType(type: string): number {
        switch (type) {
            case 'BESDate':
                return 4;
            case 'DataSize':
                return 8;
            case 'HashMatch':
            case 'Hash':
                return 0;
            case 'IPAddress':
                return 5;
            case 'Numeric':
                return 3;
            case 'NumericInteger':
                return 9;
            case 'RegexMatch':
                return 11;
            case 'String':
                return 1;
            case 'Version':
                return 2;
            case 'WMIDate':
                return 6;
            case 'TimeDiff':
                return 7;
            default:
                return 1;
        }
    }

    private static _transformSensorQuery(query: any) {
        var scriptTypes: any = {
            'WMIQuery': 1,
            'BESRelevance': 2,
            'Powershell': 5,
            'UnixShell': 6,
            'VBScript': 4,
            'Python': 8,
            'JScript': 7
        };
        //var result = { ...query };
        var result: any = {};

        var queryString: string = query.script;
        result['query'] = TransformSensor.convertWhitespace(queryString);

        if (query.script_type in scriptTypes) {
            result.sensor_type = scriptTypes[query.script_type];
        } else {
            result.sensor_type = 4;
        }
        delete result.script_type;

        result.os = TransformSensor.platformStringToInt(query.platform);
        delete result.platform;
        if (!result.signature) {
            result.signature = "";
        }
        return result;
    }

    private static platformStringToInt(platform: string): number {
        switch (platform) {
            case 'Linux':
                return 1;
            case 'Mac':
                return 2;
            case 'Solaris':
                return 3;
            case 'AIX':
                return 4;
            default:
                return 0;
        }
    }
}