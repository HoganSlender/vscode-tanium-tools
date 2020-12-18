export class TransformBase {
    static transpond(source: any, dest: any, name: string) {
        if (source[name]) {
            dest[name] = source[name];
        }
    }

    static transpondStringToInteger(source: any, dest: any, name: string) {
        if (source[name]) {
            dest[name] = this.convertInteger(source[name]);
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