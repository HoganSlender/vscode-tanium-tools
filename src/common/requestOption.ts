export function wrapOption(allow: boolean, options: any) {
    if (allow) {
        options['https'] = {
            rejectUnauthorized: !allow
        };
    }

    return options;
}

