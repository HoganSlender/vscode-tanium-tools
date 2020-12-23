export class TransformBase {
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
        if (name in source) {
            dest[name] = this.convertInteger(source[name]);
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