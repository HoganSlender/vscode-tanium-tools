export class TransformBase {
    static convertWhitespace(input: string) {
        var converted = input.replace(/\r/g, '').split(/\n/);
        if (converted[converted.length - 1] === '') {
            converted.pop();
        }

        return converted;
    }

    static deleteProperty(source: any, name: string) {
        if (name in source) {
            delete source[name];
        }
    }

    static transpond(source: any, dest: any, name: string) {
        this.transpondNewName(source, dest, name, name);
    }

    static transpondNewName(source: any, dest: any, name: string, newName: string) {
        if (name in source) {
            dest[newName] = source[name];
        }
    }

    static transpondStringToInteger(source: any, dest: any, name: string) {
        this.transpondStringToIntegerNewName(source, dest, name, name);
    }

    static transpondStringToIntegerNewName(source: any, dest: any, name: string, newName: string) {
        if (name in source) {
            dest[newName] = this.convertInteger(source[name]);
        }
    }

    static transpondIntegerToString(source: any, dest: any, name: string) {
        if (name in source) {
            dest[name] = this.convertStringToInteger(source[name]);
        }
    }

    static transpondBooleanToInteger(source: any, dest: any, name: string) {
        this.transpondBooleanToIntegerNewName(source, dest, name, name);
    }

    static transpondBooleanToIntegerInverse(source: any, dest: any, name: string) {
        this.transpondBooleanToIntegerNewNameInverse(source, dest, name, name);
    }
    
    static transpondBooleanToIntegerNewName(source: any, dest: any, name: string, newName: string) {
        if (name in source) {
            if (source[name]) {
                dest[newName] = 1;
            } else {
                dest[newName] = 0;
            }
        }
    }

    static transpondBooleanToIntegerNewNameInverse(source: any, dest: any, name: string, newName: string) {
        if (name in source) {
            if (source[name]) {
                dest[newName] = 0;
            } else {
                dest[newName] = 1;
            }
        }
    }

    static convertStringToInteger(input: any) {
        if (this.isInteger(input)) {
            return String(input);
        } else {
            return input;
        }
    }

    static convertInteger(input: string) {
        if (this.isInteger(input)) {
            return parseInt(input);
        } else {
            return input;
        }
    }

    static isInteger(n: string) {
        return !isNaN(parseInt(n));
    }
}