import {
  ProviderFacet as Provider,
  MirrorFacet as Mirror,
  GenericResolverFacet as GenericResolver,
  StreamResolverFacet as StreamResolver,
} from "anv";

export class sanitize {
  provider(data: any): Provider {
    const validData: Provider = <Provider> {};

    let valid = () => {


      return true;
    };

    return valid ? validData : null;
  }

  mirror(data: any): Mirror {
    const validData: Mirror = <Mirror> {};

    let valid = () => {


      return true;
    };

    return valid ? validData : null;
  }

  genericresolver(data: any): GenericResolver {
    const validData: GenericResolver = <GenericResolver> {};

    let valid = () => {


      return true;
    };

    return valid ? validData : null;
  }



  streamresolver(data: any): StreamResolver {
    const validData: StreamResolver = <StreamResolver> {};

    let valid = () => {


      return true;
    };

    return valid ? validData : null;
  }
}
