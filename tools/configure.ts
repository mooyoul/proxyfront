import { highlight } from "cli-highlight";
import { stripIndent } from "common-tags";
import * as crypto from "crypto";
import * as fs from "fs";
import * as inquirer from "inquirer";
import * as yml from "js-yaml";
import ow from "ow";
import * as path from "path";
import * as tldjs from "tldjs";

interface Input {
  stage: string;
  s3: {
    bucketName: string;
  };
  hasCustomDomainName: boolean;
  customDomain?: {
    hostname: string;
    certificateArn: string;
    hasRoute53Record: boolean;
    route53Record?: {
      zoneId: string;
    }
  };
  proxy: {
    type: "static-resource-proxy" | "forward-proxy";
    ttl?: number;
  };
}

// tslint:disable:no-console
(async () => {
  const { stage } = await inquirer.prompt<{ stage: "prod" | "stage" }>({
    type: "list",
    name: "stage",
    message: "Which stage do you want to configure?",
    default: "prod",
    choices: [
      "prod",
      "stage",
    ],
    validate(value) {
      try {
        ow(value, ow.string.lowercase.alphabetical.minLength(3).maxLength(16));
        return true;
      } catch (e) {
        return e.message;
      }
    },
  });

  const CONFIG_FILE_PATH = path.join(__dirname, `../config.${stage}.yml`);

  const hasConfig = await new Promise<boolean>((resolve, reject) => {
    fs.stat(CONFIG_FILE_PATH, (e) => {
      if (e) {
        if (e.code === "ENOENT") {
          return resolve(false);
        }

        reject(e);
      }

      resolve(true);
    });
  });

  if (hasConfig) {
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean; }>([{
      type: "confirm",
      name: "overwrite",
      message: stripIndent`
        Previous configuration was found.
        Are you sure to continue? You'll lose previous configuration.
      `,
      default: false,
    }]);

    if (!overwrite) {
      console.log("\nAborted.");
      return;
    }
  }

  const inputs = await inquirer.prompt<Input>([{
    type: "input",
    name: "s3.bucketName",
    message: stripIndent`
      What's the name of S3 Bucket?
      Created s3 bucket will be used for saving CloudFront Access logs.
    `,
    default() {
      return `proxyfront-${stage}-${crypto.randomBytes(8).toString("hex")}`;
    },
    validate(value) {
      try {
        ow(value, ow.string.lowercase.minLength(3).maxLength(63));

        if (!/^[a-z0-9\-]+$/i.test(value)) {
          return `Expected string to be alphanumeric or dash (-), got \`${value}\``;
        }

        if (!/^[a-z0-9]/.test(value)) {
          return `Expected first character to be alphanumeric, got \`${value}\``;
        }

        return true;
      } catch (e) {
        return e.message;
      }
    }
  }, {
    type: "confirm",
    name: "hasCustomDomainName",
    message: "Do you want to configure custom domain name?",
    default: true,
  }, {
    type: "input",
    name: "customDomain.hostname",
    when(input: Partial<Input>) {
      return input.hasCustomDomainName!;
    },
    message: "Please input custom domain name (e.g. proxy.example.com)",
    validate(value) {
      try {
        const hostname = tldjs.parse(value);
        if (!hostname.isValid || hostname.hostname !== value) {
          return `Expected valid hostname, got \`${value}\``;
        }

        if (!hostname.tldExists) {
          return `Expected valid TLD, got \`${hostname.publicSuffix}\``;
        }

        return true;
      } catch (e) {
        return e.message;
      }
    },
  }, {
    type: "input",
    name: "customDomain.certificateArn",
    when(input: Partial<Input>) {
      return input.hasCustomDomainName!;
    },
    message(input: Partial<Input>) {
      return stripIndent`
        Please input ACM Certificate ARN for \`${input.customDomain!.hostname}\`
        (e.g. arn:aws:acm:us-east-1:123456789012:certificate/00112233-4455-6677-8899-aabbccddeeff)
      `;
    },
    validate(value) {
      if (!/arn:aws:acm:[a-z0-9\-]+:[0-9]+:certificate\/[a-z0-9\-]/.test(value)) {
        return "Invalid ARN format. Please check ARN input and try again.";
      }

      const [ , , , region ] = value.split(":");
      if (region !== "us-east-1") {
        return "ACM Certificate for CloudFront distribution must be issued from us-east-1 (N. Virginia) region.";
      }

      return true;
    },
  }, {
    type: "confirm",
    name: "customDomain.hasRoute53Record",
    when(input: Partial<Input>) {
      return input.hasCustomDomainName!;
    },
    message(input: Partial<Input>) {
      return `Do you want to configure route 53 record for \`${input.customDomain!.hostname}\`?`;
    },
    default: true,
  }, {
    type: "input",
    name: "customDomain.route53Record.zoneId",
    when(input: Partial<Input>) {
      return input.hasCustomDomainName! && input.customDomain!.hasRoute53Record;
    },
    message(input: Partial<Input>) {
      return `Please input Route 53 Hosted Zone Id for \`${input.customDomain!.hostname}\``;
    },
    validate(value) {
      try {
        ow(value, ow.string.uppercase.alphanumeric.minLength(2).maxLength(32));

        return true;
      } catch (e) {
        return e.message;
      }
    },
  }, {
    type: "list",
    name: "proxy.type",
    message: "Which purpose of ProxyFront?",
    default: "static-resource-proxy",
    choices: [{
      name: "for remote static resource proxy (e.g. to cache remote static resources)",
      value: "static-resource-proxy",
    }, {
      name: "for forward proxy server",
      value: "forward-proxy",
    }],
  }, {
    type: "input",
    name: "proxy.ttl",
    when(input: Partial<Input>) {
      return input.proxy!.type === "static-resource-proxy";
    },
    message: stripIndent`
      How long cached resource stay in CloudFront?
      Specify Default TTL in seconds unit. (Default: 30 days)
    `,
    filter: Number,
    default: 2592000,
    validate(value) {
      try {
        ow(value, ow.number.greaterThanOrEqual(0).lessThanOrEqual(3153600000));
        return true;
      } catch (e) {
        return e.message;
      }
    },
  }]);

  const config = createConfigYaml({ stage, ...inputs });

  console.log("Generated configuration file contents: \n");
  console.log(highlight(config, { language: "yaml" }));

  const { hasConfirmed } = await inquirer.prompt<{ hasConfirmed: boolean; }>([{
    type: "confirm",
    name: "hasConfirmed",
    message: "Does it looks good?",
    default: true,
  }]);

  if (!hasConfirmed) {
    console.log("\nAborted.");
    return;
  }

  await new Promise<void>(((resolve, reject) => {
    fs.writeFile(CONFIG_FILE_PATH, config, (e) => {
      if (e) { return reject(e); }

      resolve();
    });
  }));

  // tslint:disable:max-line-length
  console.log("\n");
  console.log(stripIndent`
    Stack configuration file was saved to \`${CONFIG_FILE_PATH}\`.
    Now you can deploy your own ProxyFront service by calling \`${highlight("npm run deploy:prod", { language: "bash" })}\` or \`${highlight("npm run deploy:stage", { language: "bash" })}\`
    from your terminal!

    If you want to configure remote origin whitelist or CORS support,
    Feel free to edit \`src/config.ts\`.
  `);

  if (inputs.proxy.type === "forward-proxy") {
    console.log("\n");
    console.log(stripIndent`
      also, you've selected forward proxy feature.
      you can run proxy client by calling  \`${highlight("env PROXYFRONT_HOST=proxyfront.example.com npm run client", { language: "bash" })}\`!
    `);
  }

  console.log("\n🎉 Done. ");
  // tslint:enable:max-line-length
})().catch(console.error);

function createConfigYaml(input: Input): string {
  const isStaticProxy = input.proxy.type === "static-resource-proxy";
  const hasRoute53Record = input.hasCustomDomainName && input.customDomain!.hasRoute53Record;

  const config = {
    STAGE: input.stage,
    BUCKET_NAME: input.s3.bucketName,
    CLOUDFRONT_VIEWER_CERTIFICATE: input.hasCustomDomainName ?
      {
        AcmCertificateArn: input.customDomain!.certificateArn,
        SslSupportMethod: "sni-only",
        // For backward compatibility with older devices such Android 4.1.1 (ICS)
        MinimumProtocolVersion: "TLSv1",
      } :
      { CloudFrontDefaultCertificate: true },
    CLOUDFRONT_CUSTOM_DOMAIN_NAMES: input.hasCustomDomainName ?
      [input.customDomain!.hostname] :
      { Ref: "AWS::NoValue" },
    CLOUDFRONT_ALLOWED_METHODS: isStaticProxy ?
      ["GET", "HEAD", "OPTIONS"] :
      ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    CLOUDFRONT_MIN_TTL: 0,
    CLOUDFRONT_DEFAULT_TTL: isStaticProxy ?
      input.proxy.ttl! :
      0,
    CLOUDFRONT_MAX_TTL: isStaticProxy ?
      3153600000 :
      0,
    CLOUDFRONT_FORWARD_COOKIE: isStaticProxy ?
      "none" :
      "all",
    CLOUDFRONT_FORWARD_HEADER: isStaticProxy ?
      ["Origin"] :
      ["*"],
    CREATE_ROUTE53_RECORDS: hasRoute53Record ?
      "true" :
      "false",
    ROUTE53_HOSTED_ZONE_ID: hasRoute53Record ?
      input.customDomain!.route53Record!.zoneId :
      { Ref: "AWS::NoValue" },
    ROUTE53_DOMAIN_NAME: hasRoute53Record ?
      `${input.customDomain!.hostname}.` :
      { Ref: "AWS::NoValue" },
  } as any;

  return yml.safeDump(config);
}

// tslint:enable:no-console
