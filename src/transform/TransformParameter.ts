export class TransformParameter {
    public static transform(param: any) {
        var result: any = {
            'varname': param.key,
            'value': param.value
        };

        if (param.type !== null) {
            result.type = param.type;
        }

        return result;
}
}
