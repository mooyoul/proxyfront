import * as fs from "fs";
import template = require("lodash.template"); // tslint:disable-line
import * as path from "path";

const AWS_REGION_LOCATION_MAP = new Map<string, string>([
  ["us-east-2", "US East\n(Ohio)"],
  ["us-east-1", "US East\n(N. Virginia)"],
  ["us-west-1", "US West\n(N. California)"],
  ["us-west-2", "US West\n(Oregon)"],
  ["ap-south-1", "Asia Pacific\n(Mumbai)"],
  ["ap-northeast-2", "Asia Pacific\n(Seoul)"],
  ["ap-southeast-1", "Asia Pacific\n(Singapore)"],
  ["ap-southeast-2", "Asia Pacific\n(Sydney)"],
  ["ap-northeast-1", "Asia Pacific\n(Tokyo)"],
  ["ca-central-1", "Canada\n(Central)"],
  ["cn-north-1", "China\n(Beijing)"],
  ["cn-northwest-1", "China\n(Ningxia)"],
  ["eu-central-1", "EU\n(Frankfurt)"],
  ["eu-west-1", "EU\n(Ireland)"],
  ["eu-west-2", "EU\n(London)"],
  ["eu-west-3", "EU\n(Paris)"],
  ["eu-north-1", "EU\n(Stockholm)"],
  ["sa-east-1", "South America\n(São Paulo)"],
  ["us-gov-east-1", "AWS GovCloud\n(US-East)"],
  ["us-gov-west-1", "AWS GovCloud\n(US)"],
]);

const CURRENT_LOCATION = AWS_REGION_LOCATION_MAP.get(process.env.AWS_REGION!) || process.env.AWS_REGION! || "Unknown";

let renderTemplate: ReturnType<typeof template>;
export interface ErrorTemplateInput {
  requestIp: string;
  status: {
    code: number;
    description: string;
  };
  reason?: string;
  origin?: {
    hostname: string;
  };
}

export async function render(input: ErrorTemplateInput): Promise<string> {
  if (!renderTemplate) {
    const templateContent = await new Promise<string>((resolve, reject) => {
      fs.readFile(path.join(__dirname, "error.html"), { encoding: "utf8" }, (e, data) => {
        if (e) { return reject(e); }

        resolve(data);
      });
    });

    renderTemplate = template(templateContent, { variable: "data" });
  }

  return renderTemplate({
    ...input,
    location: CURRENT_LOCATION.replace(/\n/g, "<br>"),
    time: getUTCString(),
  });
}

function getUTCString() {
  const now = new Date();

  const yyyy = now.getUTCFullYear();
  const mm = `00${now.getUTCMonth() + 1}`.slice(-2);
  const dd = `00${now.getUTCDate()}`.slice(-2);
  const hh = `00${now.getUTCHours()}`.slice(-2);
  const ii = `00${now.getUTCMinutes()}`.slice(-2);
  const ss = `00${now.getUTCSeconds()}`.slice(-2);

  return `${yyyy}-${mm}-${dd} ${hh}:${ii}:${ss} UTC`;
}
