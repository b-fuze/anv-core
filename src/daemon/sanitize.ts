import {type, deepCopy} from "./utils";
import {
  ProviderFacet as Provider,
  MirrorFacet as Mirror,
  GenericResolverFacet as GenericResolver,
  StreamResolverFacet as StreamResolver,
} from "anv";

export function validStructure(input: any, output: any, structure: any) {
  // FIXME: Remove these side effects and make it part of the function, same for `output`
  const errors: string[] = [];
  const isString = (t: any) => type(t) === "string";

  function loopKeys(input: any, output: any, structure: any) {
    structKeyLoop:
    for (const [key, [required, valueTypeFull, defaultValue, constrainValues]] of (<any>Object).entries(structure)) {
      // FIXME: Support `constrainValues`
      // Module included this property
      if (input.hasOwnProperty(key)) {
        const inValue = input[key];
        const inValueType = type(input[key]);
        let inValueValid = false;
        let inValueTypeIndex = -1;

        let valueTypes: string[][] = Array.isArray(valueTypeFull)
                                   ? valueTypeFull.map(s => isString(s) ? s.split(":") : [type(s), s])
                                   : [isString(valueTypeFull) ? valueTypeFull.split(":") : [type(valueTypeFull), valueTypeFull]];

        keyValueCheckLoop:
        for (const [valueType, valueTypeArg] of valueTypes) {
          inValueTypeIndex++;

          if (valueType === inValueType) {
            inValueValid = true;
            break keyValueCheckLoop;
          }
        }

        if (inValueValid) {
          // The input value provided was valid
          if (inValueType === "object") {
            // Recursively check the input object as well
            loopKeys(inValue, output[key] = {}, valueTypes[inValueTypeIndex][1]);
          }
          // Check the values of the array items
          else if (inValueType === "array") {
            let validArray = true;

            if (valueTypes[inValueTypeIndex][1]) {
              validArray = (<any[]>inValue).every(item => type(item) === valueTypes[inValueTypeIndex][1]);
            }

            if (validArray) {
              output[key] = inValue.slice();
            } else {
              errors.push(`Wrong item types in array "${ key }", should be "${ valueTypes[inValueTypeIndex][1] }"`);
              continue structKeyLoop;
            }
          }
          // Check function argument count
          else if (inValueType === "function") {
            const arityBase = (valueTypes[inValueTypeIndex][1]);
            let arity: number[] = [];

            if (arityBase) {
              arity = arityBase.split(/,/g).map(n => +n);
            }

            if (!arity.length) {
              output[key] = inValue;
            } else {
              let validArity = false;

              arityLoop:
              for (const arityLength of arity) {
                if (inValue.length === arityLength) {
                  validArity = true;

                  break arityLoop;
                }
              }

              if (validArity) {
                output[key] = inValue;
              } else {
                errors.push(`Wrong number of arguments for function "${ key }", should be "${ arityBase }"`);
                continue structKeyLoop;
              }
            }
          }
          // Simple primitive value, it passes so just push to output
          else {
            output[key] = inValue;
          }
        } else {
          errors.push(`Wrong type "${ inValueType }" for "${ key }", should be "${ valueTypes[0][0] }"`);
        }
      }
      // Module omitted this property
      else {
        if (required) {
          errors.push(`Missing required property "${ key }"`);
        } else {
          switch (type(defaultValue)) {
            case "object":
              output[key] = deepCopy(defaultValue);
              break;
            case "array":
              output[key] = defaultValue.slice();
              break;
            default:
              output[key] = defaultValue;
          }
        }
      }
    }
  }

  loopKeys(input, output, structure);

  return {
    errors: errors,
    output,
  };
}

export class sanitize {
  static provider(data: any): {
    errors: string[],
    data: Provider,
  } {
    const validData: Provider = <Provider> {};
    let validationErrors: string[] = [];

    const {errors, output} = validStructure(data, validData, {
      name: [true, "string"],
      displayName: [false, "string", null],
      description: [false, "string", null],
      weight: [false, "number", 0],
      cacheSource: [false, "boolean", true],
      delay: [false, ["number", "function:2"], 500],
      resolvers: [false, {
        mediaList: [false, "string", "basic"],
        mediaSource: [false, "string", "basic"],
      }, {
        mediaList: "basic",
        mediaSource: "basic",
      }],
      hosts: [true, "array:string"],
      validUrl: [true, "function:2"],
      tiers: [false, "array", []],
      mediaList: [true, "function:1"],
      mediaSource: [false, "function:2"],
      search: [false, "function:1"],
    });

    if (Array.isArray(output.tiers)) {
      for (const tier of output.tiers) {
        if (!Array.isArray(tier) || tier.length !== 2 || (typeof tier[0] !== "string" || typeof tier[1] !== "string")) {
          errors.push("Tiers should be an array of 2 length tuples of strings");
          break;
        }
      }
    }

    validationErrors = validationErrors.concat(errors);

    return {
      errors: validationErrors,
      data: validData,
    };
  }

  static mirror(data: any): {
    errors: string[],
    data: Mirror,
  } {
    const validData: Mirror = <Mirror> {};
    let validationErrors: string[] = [];

    const {errors, output} = validStructure(data, validData, {
      name: [true, "string"],
      displayName: [false, "string", null],
      description: [false, "string", null],
      weight: [false, "number", 0],
      cache: [false, "boolean", false],
      delay: [false, ["number", "function:2"], 500],
      maxConnections: [false, "number", 0],
      resolver: [false, "string", "basic"],
      streamResolver: [false, "string", "basic"],
      hosts: [true, "array:string"],
      validUrl: [true, "function:1"],
      tiers: [false, "array", []],
      media: [true, "function:3"],
    });

    validationErrors = validationErrors.concat(errors);

    return {
      errors: validationErrors,
      data: validData,
    };
  }

  static genericresolver(data: any): {
    errors: string[],
    data: GenericResolver,
  } {
    const validData: GenericResolver = <GenericResolver> {};
    let validationErrors: string[] = [];

    const {errors, output} = validStructure(data, validData, {
      name: [true, "string"],
      description: [false, "string", null],
      weight: [false, "number", 0],
      resolve: [true, "function:2,3"],
    });

    validationErrors = validationErrors.concat(errors);

    return {
      errors: validationErrors,
      data: validData,
    };
  }

  static streamresolver(data: any): {
    errors: string[],
    data: StreamResolver,
  } {
    const validData: StreamResolver = <StreamResolver> {};
    let validationErrors: string[] = [];

    const {errors, output} = validStructure(data, validData, {
      name: [true, "string"],
      description: [false, "string", null],
      resolve: [true, "function:5"],
    });

    validationErrors = validationErrors.concat(errors);

    return {
      errors: validationErrors,
      data: validData,
    };
  }
}
